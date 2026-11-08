import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ACTIVITY_OPERATION_TYPES,
  DEFAULT_THRESHOLDS,
  formatManilaDateTime,
  getParameterStatus,
  getReadingStatuses,
  getRaisingDay,
  toCsv,
  validateActivityLog,
  validateThresholds,
} from '@hydrosense/shared';
import type { ActivityLog, AlertItem, MeasuredParameter, Threshold } from '@hydrosense/shared';
import type { MainTabParamList, RootStackParamList } from './navigation';
import { DATA_MODE, API_BASE_URL, api } from './services/client';
import { useSession, useTankSelection } from './state';
import { Button, Card, colors, DataRow, Page, StateMessage, Title, ui } from './components/ui';

type Props<T extends keyof MainTabParamList> = BottomTabScreenProps<MainTabParamList, T>;
type RootProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return <View style={ui.formField}><Text style={ui.label}>{label}</Text><TextInput style={ui.input} value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} /></View>;
}

function TankPicker() {
  const { tanks, tankId, setTankId, isLoading, error, refetch } = useTankSelection();
  if (isLoading) return <StateMessage message="Loading tanks…" loading />;
  if (error) return <Card><StateMessage message={`Could not load tanks: ${error.message}`} /><Button label="Retry tank list" onPress={refetch} secondary /></Card>;
  if (tanks.length === 0) return <StateMessage message="No tanks are available for this account." />;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tanks.map((tank) => <Pressable key={tank.id} onPress={() => setTankId(tank.id)} style={{ borderRadius: 18, borderWidth: 1, borderColor: tank.id === tankId ? colors.teal : colors.border, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: tank.id === tankId ? '#e2f2ef' : 'white' }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{tank.name}</Text></Pressable>)}</View>;
}

export function LoginScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function signInWithApi() {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
        },
        body: JSON.stringify({ email, password }),
      });
      const responseBody = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(responseBody);
      } catch {
        if (!response.ok) throw new Error('Sign-in failed. Check your credentials and account approval.');
        throw new Error('The sign-in response is invalid.');
      }
      if (typeof result !== 'object' || result === null) {
        throw new Error('The sign-in response is invalid.');
      }
      if ('status' in result && result.status === 'pending') throw new Error('This account is awaiting administrator approval.');
      if (!response.ok) throw new Error('Sign-in failed. Check your credentials and account approval.');
      if (!('user' in result) || typeof result.user !== 'object' || result.user === null) throw new Error('The sign-in response is invalid.');
      const authResult = result as { token?: unknown; accessToken?: unknown; user: unknown };
      const user = authResult.user as { id?: unknown; firstName?: unknown; lastName?: unknown; name?: unknown; role?: unknown };
      if (typeof user.id !== 'string' || user.id.trim().length === 0) throw new Error('The sign-in response is missing a valid user ID.');
      if (user.role !== 'operator' && user.role !== 'manager' && user.role !== 'admin') throw new Error('This account is not approved for access.');
      const name = typeof user.name === 'string' ? user.name : `${String(user.firstName ?? '')} ${String(user.lastName ?? '')}`.trim();
      const token = typeof authResult.accessToken === 'string' ? authResult.accessToken : typeof authResult.token === 'string' ? authResult.token : undefined;
      await signIn({ id: user.id, name: name || email, role: user.role }, token);
    } catch (error) {
      Alert.alert('Unable to sign in', error instanceof Error ? error.message : 'An unexpected sign-in error occurred.');
    } finally {
      setBusy(false);
    }
  }

  return <Page>
    <Title detail="Water quality monitoring and alerts for hatchery operations">HydroSense Mobile</Title>
    <Card title="Sign in">
      {DATA_MODE === 'mock' ? <>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>Demo-only access uses sample data. This does not authenticate with a backend.</Text>
        <Button label="Continue as demo operator" onPress={() => void signIn({ id: 'demo-operator', name: 'Demo Operator', role: 'operator' }).catch((error: unknown) => Alert.alert('Unable to sign in', error instanceof Error ? error.message : 'An unexpected sign-in error occurred.'))} />
      </> : <>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="name@example.com" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" />
        <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy || !email || !password} onPress={() => void signInWithApi()} />
      </>}
    </Card>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Monitoring and alert system only. No device controls are available.</Text>
  </Page>;
}

export function HomeScreen({ navigation }: Props<'Home'>) {
  const { tankId, tanks } = useTankSelection();
  const { data: reading, isLoading, isError, refetch } = useQuery({ queryKey: ['latest-reading', tankId], queryFn: () => api.getLatestReading(tankId), enabled: Boolean(tankId) });
  const thresholds = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const advisories = useQuery({ queryKey: ['advisories', tankId], queryFn: () => api.listAdvisories(tankId), enabled: Boolean(tankId) });
  const devices = useQuery({ queryKey: ['device-statuses'], queryFn: () => api.listDeviceStatuses() });
  const alerts = useQuery({ queryKey: ['alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) });
  const tank = tanks.find((item) => item.id === tankId);
  const statuses = reading ? getReadingStatuses(reading, thresholds.data ?? DEFAULT_THRESHOLDS) : null;
  const device = devices.data?.find((item) => item.deviceId === tank?.deviceId);
  const openCount = alerts.data?.filter((item) => item.status !== 'resolved').length ?? 0;
  return <Page>
    <Title detail="Live water-quality status">Home</Title>
    <TankPicker />
    {isLoading ? <StateMessage message="Loading latest readings…" loading /> : isError ? <Card><StateMessage message="Could not load readings." /><Button label="Retry" onPress={() => void refetch()} secondary /></Card> : reading && statuses ? <Card title={tank?.name ?? 'Selected tank'} action={<Text style={{ color: device?.online ? colors.teal : colors.critical, fontWeight: '800' }}>{device?.online ? 'ONLINE' : 'OFFLINE'}</Text>}>
      <Text style={{ color: colors.muted }}>Rearing day {tank ? getRaisingDay(tank.rearingStartDate) : '—'} · Updated {formatManilaDateTime(reading.timestamp)} PHT</Text>
      <DataRow label="Temperature" value={`${reading.temperature.toFixed(1)} °C`} detail={`${statuses.temperature.label} · ${statuses.temperature.distance}`} />
      <DataRow label="Dissolved oxygen" value={`${reading.doMgL.toFixed(1)} mg/L`} detail={`${statuses.do.label} · ${statuses.do.distance}`} />
      <DataRow label="pH" value={reading.ph.toFixed(2)} detail={`${statuses.ph.label} · ${statuses.ph.distance}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(advisories.data ?? []).map((item) => <Text key={item.kind} style={{ color: colors.ink, backgroundColor: '#e8f4f2', padding: 8, borderRadius: 8, fontWeight: '700' }}>{item.kind} advisory: {item.level}</Text>)}</View>
      <Text style={{ color: colors.muted }}>Battery {device?.batteryPct ?? '—'}% · {device?.powerSource ?? 'Unknown'} · {openCount} active alerts</Text>
      <Button label="Calibration helper" secondary onPress={() => navigation.getParent()?.navigate('Calibration')} />
    </Card> : <StateMessage message="No reading is available for this tank." />}
    <Button label="Record manual water test" onPress={() => navigation.getParent()?.navigate('FieldEntry')} secondary />
  </Page>;
}

function alertTitle(alert: AlertItem) {
  return `${alert.parameter} · ${alert.severity}`;
}

export function AlertsScreen({ navigation }: Props<'Alerts'>) {
  const { tankId } = useTankSelection();
  const query = useQuery({ queryKey: ['alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) });
  const rows = [...(query.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <Page>
    <Title detail="Review active and recent alerts">Alerts</Title>
    <TankPicker />
    <Card title="Alert list">
      {query.isLoading ? <StateMessage message="Loading alerts…" loading /> : query.isError ? <StateMessage message="Alert data could not be loaded." /> : rows.length === 0 ? <StateMessage message="No alerts are recorded for this tank." /> : rows.map((alert) => <Pressable key={alert.id} onPress={() => navigation.getParent()?.navigate('AlertDetail', { alertId: alert.id })} style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 4 }}>
        <Text style={{ color: alert.severity === 'critical' ? colors.critical : colors.warning, fontWeight: '800' }}>{alertTitle(alert)} · {alert.status}</Text>
        <Text style={{ color: colors.ink }}>{alert.value} · threshold {alert.threshold}</Text>
        <Text style={{ color: colors.muted }}>{formatManilaDateTime(alert.createdAt)} PHT · tap for details</Text>
      </Pressable>)}
    </Card>
  </Page>;
}

export function AlertDetailScreen({ route }: RootProps<'AlertDetail'>) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const alertQuery = useQuery({ queryKey: ['alert-detail', route.params.alertId], queryFn: async () => (await api.listAlerts()).find((item) => item.id === route.params.alertId) ?? null });
  const responses = useQuery({ queryKey: ['alert-responses', route.params.alertId], queryFn: () => api.listAlertResponses(route.params.alertId) });
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: async (status: 'acknowledge' | 'resolve') => {
      if (note.trim().length < 4) throw new Error('Add a response note with at least 4 characters.');
      const input = { note: note.trim(), user: user?.name ?? 'Mobile user' };
      if (status === 'acknowledge') return api.acknowledgeAlert(route.params.alertId, input);
      const alert = (await api.listAlerts()).find((item) => item.id === route.params.alertId);
      if (!alert) throw new Error('The alert could not be found.');
      const resolved = await api.resolveAlert(route.params.alertId, input);
      await api.createActivityLog({
        tankId: alert.tankId,
        kind: 'ALERT RESOLUTION',
        type: `${alert.parameter} alert resolved`,
        operator: input.user,
        notes: input.note.trim(),
      });
      return resolved;
    },
    onSuccess: async () => {
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['alert-detail', route.params.alertId] }),
        queryClient.invalidateQueries({ queryKey: ['alert-responses', route.params.alertId] }),
        queryClient.invalidateQueries({ queryKey: ['activity-logs'] }),
      ]);
    },
  });
  const alert = alertQuery.data;
  return <Page>
    <Title detail="Acknowledge, investigate, and record resolution">Alert detail</Title>
    {alertQuery.isLoading ? <StateMessage message="Loading alert…" loading /> : alertQuery.isError ? <StateMessage message="Could not load alert details." /> : !alert ? <StateMessage message="Alert was not found." /> : <Card title={alertTitle(alert)}>
      <DataRow label="Tank" value={alert.tankId} />
      <DataRow label="Value" value={`${alert.value}`} detail={`Threshold: ${alert.threshold}`} />
      <DataRow label="Status" value={alert.status} detail={`Created ${formatManilaDateTime(alert.createdAt)} PHT`} />
      <Field label="Response note" value={note} onChangeText={setNote} placeholder="What did you observe or verify?" />
      {alert.status === 'open' && <Button label="Acknowledge" disabled={mutation.isPending} onPress={() => mutation.mutate('acknowledge')} secondary />}
      {alert.status !== 'resolved' && <Button label="Resolve alert" disabled={mutation.isPending} onPress={() => mutation.mutate('resolve')} />}
      {mutation.isError && <Text style={{ color: colors.critical }}>{mutation.error.message}</Text>}
      <Text style={{ color: colors.ink, fontWeight: '800', marginTop: 8 }}>Response history</Text>
      {responses.isLoading ? <StateMessage message="Loading responses…" loading /> : (responses.data ?? []).length === 0 ? <Text style={{ color: colors.muted }}>No responses recorded.</Text> : responses.data?.map((response) => <Text key={response.id} style={{ color: colors.muted }}>{response.status} · {response.createdBy} · {formatManilaDateTime(response.createdAt)} PHT · {response.note}</Text>)}
    </Card>}
  </Page>;
}

export function TrendsScreen() {
  const { tankId } = useTankSelection();
  const from = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);
  const readings = useQuery({ queryKey: ['mobile-trends', tankId], queryFn: () => api.listReadings({ tankId, from }), enabled: Boolean(tankId) });
  const data = (readings.data ?? []).map((row, index) => ({ value: row.doMgL, label: index % 2 === 0 ? new Date(row.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '' }));
  return <Page>
    <Title detail="Latest 24 hours · 3-hour sampling cadence">Trends</Title>
    <TankPicker />
    {readings.isLoading ? <StateMessage message="Loading trend data…" loading /> : readings.isError ? <StateMessage message="Could not load trends." /> : data.length < 2 ? <StateMessage message="Not enough readings to draw a trend." /> : <Card title="Dissolved oxygen · mg/L">
      <LineChart data={data} width={300} height={180} spacing={50} color={colors.teal} thickness={3} dataPointsColor={colors.teal} yAxisTextStyle={{ color: colors.muted }} xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }} />
      <Text style={{ color: colors.muted }}>Safe minimum: 4 mg/L. Trend view is informational; review each point alongside the alert history.</Text>
    </Card>}
  </Page>;
}

export function HistoryScreen() {
  const { tankId } = useTankSelection();
  const readings = useQuery({ queryKey: ['mobile-history', tankId], queryFn: () => api.listReadings({ tankId }), enabled: Boolean(tankId) });
  const rows = [...(readings.data ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
  return <Page>
    <Title detail="Recent sensor readings, shown in Asia/Manila time">Reading history</Title>
    <TankPicker />
    <Card title="Latest readings">
      {readings.isLoading ? <StateMessage message="Loading history…" loading /> : readings.isError ? <StateMessage message="Could not load reading history." /> : rows.length === 0 ? <StateMessage message="No history is available." /> : rows.map((reading) => <View key={reading.id} style={{ paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 3 }}>
        <Text style={{ color: colors.ink, fontWeight: '800' }}>{formatManilaDateTime(reading.timestamp)} PHT</Text>
        <Text style={{ color: colors.muted }}>{reading.temperature.toFixed(1)} °C · {reading.doMgL.toFixed(1)} mg/L DO · pH {reading.ph.toFixed(2)}</Text>
      </View>)}
    </Card>
  </Page>;
}

export function StatusScreen() {
  const { tankId, tanks } = useTankSelection();
  const statuses = useQuery({ queryKey: ['device-statuses'], queryFn: () => api.listDeviceStatuses() });
  const tank = tanks.find((item) => item.id === tankId);
  const device = statuses.data?.find((item) => item.deviceId === tank?.deviceId);
  return <Page>
    <Title detail="Sensor and connectivity health">System status</Title>
    <TankPicker />
    {statuses.isLoading ? <StateMessage message="Loading device status…" loading /> : statuses.isError ? <StateMessage message="Could not load device status." /> : !device ? <StateMessage message="No device is registered for this tank." /> : <Card title={device.deviceId}>
      <DataRow label="Connection" value={device.online ? 'Online' : 'Offline'} detail={`Last seen ${formatManilaDateTime(device.lastSeen)} PHT`} />
      <DataRow label="Battery" value={`${device.batteryPct}%`} detail={`Power source: ${device.powerSource}`} />
      <DataRow label="Wi-Fi signal" value={`${device.wifiRssi} dBm`} />
      <DataRow label="Pending offline records" value={`${device.pendingSyncCount}`} />
    </Card>}
  </Page>;
}

export function SettingsScreen({ navigation }: Props<'Settings'>) {
  const { user, signOut } = useSession();
  const { tankId } = useTankSelection();
  const { data: thresholds = [] } = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Threshold[]>([]);
  const canEdit = user?.role === 'manager' || user?.role === 'admin';
  const mutation = useMutation({
    mutationFn: () => {
      const values: Record<MeasuredParameter, { min?: number; max?: number }> = {
        temperature: {},
        do: {},
        ph: {},
      };
      drafts.forEach((item) => { values[item.parameter] = { min: item.min, max: item.max }; });
      const issues = validateThresholds(values);
      if (issues.length) throw new Error(issues[0].message);
      return api.updateThresholds(drafts, user?.name ?? 'Mobile manager');
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['thresholds'] });
      Alert.alert('Saved', 'Threshold updates are now active.');
    },
  });
  function updateThreshold(parameter: MeasuredParameter, key: 'min' | 'max', value: string) {
    setDrafts((current) => {
      const source = current.length ? current : thresholds;
      return source.map((item) => item.parameter === parameter ? { ...item, [key]: value === '' ? undefined : Number(value) } : item);
    });
  }
  return <Page>
    <Title detail={`${user?.name ?? 'User'} · ${user?.role ?? ''}`}>Settings</Title>
    <TankPicker />
    <Card title="Field tools">
      <Button label="Calibration helper" secondary onPress={() => navigation.getParent()?.navigate('Calibration')} />
      <Button label="Manual salinity / ammonia entry" secondary onPress={() => navigation.getParent()?.navigate('FieldEntry')} />
      <Button label="Export report" secondary onPress={() => navigation.getParent()?.navigate('Export')} />
    </Card>
    {canEdit && <Card title="Thresholds">
      {(['temperature', 'do', 'ph'] as const).map((parameter) => {
        const row = (drafts.length ? drafts : thresholds).find((item) => item.parameter === parameter);
        return <View key={parameter} style={{ gap: 6, marginBottom: 8 }}>
          <Text style={ui.label}>{parameter === 'do' ? 'Dissolved oxygen' : parameter}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[ui.input, { flex: 1 }]} keyboardType="numeric" placeholder="Minimum" value={row?.min === undefined ? '' : String(row.min)} onChangeText={(value) => updateThreshold(parameter, 'min', value)} />
            <TextInput style={[ui.input, { flex: 1 }]} keyboardType="numeric" placeholder="Maximum" value={row?.max === undefined ? '' : String(row.max)} onChangeText={(value) => updateThreshold(parameter, 'max', value)} />
          </View>
        </View>;
      })}
      <Button label="Save thresholds" disabled={mutation.isPending || !drafts.length} onPress={() => mutation.mutate()} />
      {mutation.isError && <Text style={{ color: colors.critical }}>{mutation.error.message}</Text>}
    </Card>}
    <Button label="Sign out" secondary onPress={() => void signOut().catch((error: unknown) => Alert.alert('Sign-out cleanup issue', error instanceof Error ? error.message : 'Some local data could not be cleared.'))} />
    <Text style={{ color: colors.muted, fontSize: 12 }}>Mode: {DATA_MODE} · Tank: {tankId}</Text>
  </Page>;
}

export function CalibrationScreen() {
  const { tankId } = useTankSelection();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [parameter, setParameter] = useState<'ph' | 'do'>('ph');
  const [standard, setStandard] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      if (!tankId || !standard.trim() || !Number.isFinite(Number(before)) || !Number.isFinite(Number(after))) throw new Error('Choose a tank and enter a standard plus before/after readings.');
      const date = new Date();
      const nextDue = new Date(date.getTime() + 30 * 86_400_000);
      return api.createCalibrationLog({ tankId, parameter, standard: standard.trim(), before: Number(before), after: Number(after), date: date.toISOString(), user: user?.name ?? 'Mobile operator', nextDue: nextDue.toISOString() });
    },
    onSuccess: async () => {
      setStandard(''); setBefore(''); setAfter('');
      await queryClient.invalidateQueries({ queryKey: ['calibrations'] });
      Alert.alert('Calibration saved', 'The calibration record was recorded.');
    },
  });
  return <Page>
    <Title detail="Record pH and dissolved-oxygen instrument checks">Calibration helper</Title>
    <TankPicker />
    <Card title="Calibration record">
      <View style={{ flexDirection: 'row', gap: 8 }}><Button label="pH" secondary={parameter !== 'ph'} onPress={() => setParameter('ph')} /><Button label="Dissolved oxygen" secondary={parameter !== 'do'} onPress={() => setParameter('do')} /></View>
      <Field label="Calibration standard" value={standard} onChangeText={setStandard} placeholder={parameter === 'ph' ? 'pH 7.00 buffer' : 'Zero oxygen / air-saturated standard'} />
      <Field label="Before calibration" value={before} onChangeText={setBefore} keyboardType="numeric" placeholder="Reading before adjustment" />
      <Field label="After calibration" value={after} onChangeText={setAfter} keyboardType="numeric" placeholder="Reading after adjustment" />
      <Button label="Save calibration log" disabled={mutation.isPending} onPress={() => mutation.mutate()} />
      {mutation.isError && <Text style={{ color: colors.critical }}>{mutation.error.message}</Text>}
    </Card>
    <ManualEntryCard />
  </Page>;
}

function ManualEntryCard() {
  const { tankId } = useTankSelection();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [salinity, setSalinity] = useState('');
  const [ammonia, setAmmonia] = useState('');
  const [notes, setNotes] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      const values = {
        ...(salinity.trim() ? { salinity: Number(salinity) } : {}),
        ...(ammonia.trim() ? { ammonia: Number(ammonia) } : {}),
        method: 'Field test kit / refractometer',
      };
      const entry: Omit<ActivityLog, 'id' | 'occurredAt'> = {
        tankId,
        kind: 'OPERATION',
        type: ACTIVITY_OPERATION_TYPES[1],
        operator: user?.name ?? 'Mobile operator',
        notes: notes.trim(),
        manualReadings: values,
      };
      const issues = validateActivityLog(entry);
      if (!tankId || issues.length) throw new Error(issues[0]?.message ?? 'Select a tank first.');
      if (salinity && (!Number.isFinite(Number(salinity)) || Number(salinity) < 0 || Number(salinity) > 100)) throw new Error('Salinity must be between 0 and 100 ppt.');
      if (ammonia && (!Number.isFinite(Number(ammonia)) || Number(ammonia) < 0 || Number(ammonia) > 100)) throw new Error('Ammonia must be between 0 and 100.');
      return api.createActivityLog(entry);
    },
    onSuccess: async () => {
      setSalinity(''); setAmmonia(''); setNotes('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['activity-logs'] }),
        queryClient.invalidateQueries({ queryKey: ['advisories', tankId] }),
      ]);
      Alert.alert('Manual readings saved', 'The field readings are available in the activity log.');
    },
  });
  return <Card title="Field water-quality entry">
    <Field label="Salinity (ppt)" value={salinity} onChangeText={setSalinity} keyboardType="numeric" placeholder="Optional" />
    <Field label="Ammonia (mg/L)" value={ammonia} onChangeText={setAmmonia} keyboardType="numeric" placeholder="Optional" />
    <Field label="Notes (required)" value={notes} onChangeText={setNotes} placeholder="At least 4 characters" />
    <Button label="Save field readings" disabled={mutation.isPending} onPress={() => mutation.mutate()} />
    {mutation.isError && <Text style={{ color: colors.critical }}>{mutation.error.message}</Text>}
  </Card>;
}

export function FieldEntryScreen() {
  return <Page><Title detail="Record manual advisory inputs">Field entry</Title><TankPicker /><ManualEntryCard /></Page>;
}

export function ExportScreen() {
  const { tankId } = useTankSelection();
  const { user } = useSession();
  const readings = useQuery({ queryKey: ['mobile-export-readings', tankId], queryFn: () => api.listReadings({ tankId }), enabled: Boolean(tankId) });
  const alerts = useQuery({ queryKey: ['mobile-export-alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) });
  const [sharing, setSharing] = useState(false);
  const csv = useMemo(() => {
    const header = ['Timestamp (ISO)', 'Tank', 'Temperature °C', 'DO mg/L', 'pH'];
    const rows = (readings.data ?? []).map((row) => [row.timestamp, row.tankId, row.temperature, row.doMgL, row.ph]);
    return toCsv([header, ...rows]);
  }, [readings.data]);
  async function shareCsv() {
    setSharing(true);
    try {
      if (!FileSystem.documentDirectory || !(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
      const fileUri = `${FileSystem.documentDirectory}hydrosense-readings-${new Date().toISOString().slice(0, 10)}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share HydroSense readings CSV' });
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'The share sheet could not be opened.');
    } finally {
      setSharing(false);
    }
  }
  return <Page>
    <Title detail="Share sensor readings for hatchery records">Export</Title>
    <TankPicker />
    <Card title="CSV export">
      {readings.isLoading || alerts.isLoading ? <StateMessage message="Preparing export…" loading /> : readings.isError ? <StateMessage message="Could not load readings." /> : <>
        <DataRow label="Tank" value={tankId} />
        <DataRow label="Readings" value={`${readings.data?.length ?? 0}`} />
        <DataRow label="Alerts" value={`${alerts.data?.length ?? 0}`} />
        <Text style={{ color: colors.muted }}>The shared export includes formula-injection protection and preserves ISO timestamps.</Text>
        <Button label={sharing ? 'Opening share sheet…' : 'Share readings CSV'} disabled={sharing || !readings.data?.length} onPress={() => void shareCsv()} />
      </>}
    </Card>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Prepared by {user?.name ?? 'user'}. PDF/XLSX file generation is not yet available in the mobile app.</Text>
  </Page>;
}

export function ConnectionNotice({ online }: { online: boolean }) {
  if (online) return null;
  return <View style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 100, backgroundColor: colors.offline, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: colors.warning, fontWeight: '800' }}>Offline · showing cached data when available</Text></View>;
}
