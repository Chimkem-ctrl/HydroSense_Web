import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LineChart } from 'react-native-gifted-charts';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ACTIVITY_OPERATION_TYPES,
  formatManilaDateTime,
  formatParameter,
  getParameterStatus,
  getReadingStatuses,
  getRaisingDay,
  toCsv,
  validateAcknowledgeNote,
  validateActivityLog,
  validateThresholds,
} from '@hydrosense/shared';
import type { ActivityLog, AlertItem, MeasuredParameter, Reading, Role, Threshold } from '@hydrosense/shared';
import type { MainTabParamList, RootStackParamList } from './navigation';
import { DATA_MODE, api, listPendingAccounts, reviewPendingAccount } from './services/client';
import { canAccess } from './access';
import { useSession, useTankSelection } from './state';
import { Button, Card, createFormStyles, DataRow, Page, StateMessage, Title } from './components/ui';
import { useTheme } from './theme';
import type { ThemeChoice } from './theme';

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
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  return <View style={ui.formField}><Text style={ui.label}>{label}</Text><TextInput style={ui.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} /></View>;
}

function TankPicker() {
  const { colors } = useTheme();
  const { tanks, tankId, setTankId, isLoading, error, refetch } = useTankSelection();
  if (isLoading) return <StateMessage message="Loading tanks…" loading />;
  if (error) return <Card><StateMessage message={`Could not load tanks: ${error.message}`} /><Button label="Retry tank list" onPress={refetch} secondary /></Card>;
  if (tanks.length === 0) return <StateMessage message="No tanks are available for this account." />;
  return <View accessibilityLabel="Select tank" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tanks.map((tank) => <Pressable accessibilityRole="button" accessibilityState={{ selected: tank.id === tankId }} key={tank.id} onPress={() => setTankId(tank.id)} style={{ minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: tank.id === tankId ? colors.teal : colors.border, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: tank.id === tankId ? colors.selected : colors.surface }}><Text style={{ color: tank.id === tankId ? colors.teal : colors.ink, fontWeight: '700' }}>{tank.name}</Text></Pressable>)}</View>;
}

function ReadingCard({ parameter, reading, threshold }: { parameter: MeasuredParameter; reading: Reading; threshold?: Threshold }) {
  const { colors } = useTheme();
  const value = parameter === 'do' ? reading.doMgL : reading[parameter];
  const status = getParameterStatus(parameter, value, threshold);
  const label = parameter === 'temperature' ? 'Temperature' : parameter === 'do' ? 'Dissolved oxygen' : 'pH';
  const unit = parameter === 'temperature' ? '°C' : parameter === 'do' ? 'mg/L' : 'pH';
  const min = threshold?.min;
  const max = threshold?.max;
  const safe = min !== undefined && max !== undefined ? `${min}–${max} ${unit}` : min !== undefined ? `≥${min} ${unit}` : max !== undefined ? `≤${max} ${unit}` : 'Not configured';
  const scaleMin = min !== undefined && max !== undefined ? min : min !== undefined ? Math.min(0, min) : max !== undefined ? Math.min(0, max) : undefined;
  const scaleMax = min !== undefined && max !== undefined ? max : min !== undefined ? Math.max(min * 2, min + 1) : max !== undefined ? Math.max(max, 1) : undefined;
  const position = scaleMin !== undefined && scaleMax !== undefined && scaleMax > scaleMin
    ? Math.max(0, Math.min(100, (value - scaleMin) / (scaleMax - scaleMin) * 100)) : null;
  const statusColor = status.level === 'normal' ? colors.normal : status.level === 'warning' ? colors.warning : colors.critical;
  return <Card>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: statusColor, borderColor: statusColor, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, fontWeight: '700' }}>{status.label}</Text>
    </View>
    <Text style={{ color: colors.ink, fontSize: 38, fontWeight: '400' }}>{formatParameter(parameter, value)}</Text>
    <Text style={{ color: colors.muted, lineHeight: 20 }}>{status.distance}{'\n'}Safe {safe}</Text>
    {position !== null && <View style={{ gap: 8, marginTop: 4 }}>
      <LinearGradient colors={['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 8, borderRadius: 8, marginHorizontal: 7 }}>
        <View style={{ position: 'absolute', left: `${position}%`, top: -4, marginLeft: -7, height: 16, width: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface }} />
      </LinearGradient>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Display scale {scaleMin}–{scaleMax} {unit}{scaleMin !== undefined && scaleMax !== undefined && (value < scaleMin || value > scaleMax) ? ' · marker at scale edge' : ''}</Text>
    </View>}
    <Text style={{ color: colors.muted, fontSize: 12 }}>Updated {formatManilaDateTime(reading.timestamp)} PHT</Text>
  </Card>;
}

export function HomeScreen({ navigation }: Props<'Home'>) {
  const { colors } = useTheme();
  const { user } = useSession();
  const { width } = useWindowDimensions();
  const { tankId, tanks } = useTankSelection();
  const { data: reading, isLoading, isError, refetch } = useQuery({ queryKey: ['latest-reading', tankId], queryFn: () => api.getLatestReading(tankId), enabled: Boolean(tankId) });
  const thresholds = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const advisories = useQuery({ queryKey: ['advisories', tankId], queryFn: () => api.listAdvisories(tankId), enabled: Boolean(tankId) });
  const devices = useQuery({ queryKey: ['device-statuses'], queryFn: () => api.listDeviceStatuses() });
  const alerts = useQuery({ queryKey: ['alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) });
  const tank = tanks.find((item) => item.id === tankId);
  const statuses = reading && thresholds.data ? getReadingStatuses(reading, thresholds.data) : null;
  const device = devices.data?.find((item) => item.deviceId === tank?.deviceId);
  const openCount = alerts.data?.filter((item) => item.status !== 'resolved').length ?? 0;
  return <Page>
    <View style={{ gap: 5 }}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.4 }}>WATER QUALITY MONITORING</Text><Text style={{ color: colors.ink, fontSize: 28, fontWeight: '500' }}>Welcome, {user?.name}.</Text></View>
    <Title detail={tank ? `${tank.name} · ${tank.site} · rearing day ${getRaisingDay(tank.rearingStartDate)}/21` : 'Live water-quality status'}>Live monitor</Title>
    <TankPicker />
    {isLoading || thresholds.isLoading ? <StateMessage message="Loading latest readings and thresholds…" loading /> : isError || thresholds.isError ? <Card><StateMessage message={`Could not load readings or thresholds: ${(thresholds.error ?? null)?.message ?? 'Check your connection.'}`} /><Button label="Retry" onPress={() => { void refetch(); void thresholds.refetch(); }} secondary /></Card> : reading && statuses ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {(['temperature', 'do', 'ph'] as const).map((parameter) => <View key={parameter} style={{ width: width >= 950 ? '32%' : width >= 600 ? '48%' : '100%' }}><ReadingCard parameter={parameter} reading={reading} threshold={thresholds.data?.find((item) => item.parameter === parameter)} /></View>)}
      </View>
      <Card title="Water-quality advisories">
        <Text style={{ color: colors.muted, lineHeight: 20 }}>Salinity and ammonia are not measured by the sensors. These rule-based advisories are not readings.</Text>
        {advisories.isLoading ? <StateMessage message="Loading advisories…" loading /> : advisories.isError ? <StateMessage message="Could not load advisories." /> : (advisories.data ?? []).length === 0 ? <StateMessage message="No advisories are available for this tank." /> : advisories.data?.map((item) => <DataRow key={item.kind} label={`${item.kind === 'salinity' ? 'Salinity' : 'Ammonia'} risk`} value={item.level.toUpperCase()} />)}
      </Card>
      <Card title="Last update"><Text style={{ color: colors.ink, fontWeight: '700' }}>{formatManilaDateTime(reading.timestamp)} PHT</Text><Text style={{ color: colors.muted }}>Readings are sampled every 3 hours.</Text></Card>
      <Card title="Device connection">
        {devices.isLoading ? <StateMessage message="Loading device status…" loading /> : devices.isError ? <StateMessage message="Could not load device status." /> : !device ? <StateMessage message="No device is registered for this tank." /> : <>
          <DataRow label="Connection" value={device.online ? 'Online' : 'Offline'} />
          <DataRow label="Battery" value={device.batteryPct > 0 ? `${device.batteryPct}%` : 'Unavailable'} detail={`Power source: ${device.powerSource}`} />
          {alerts.isError ? <StateMessage message="Could not load alerts." /> : <DataRow label="Active alerts" value={alerts.isLoading ? 'Loading…' : `${openCount}`} />}
        </>}
        <Button label="Calibration helper" secondary onPress={() => navigation.getParent()?.navigate('Calibration')} />
      </Card>
    </> : <StateMessage message="No reading is available for this tank." />}
    <Button label="Record manual water test" onPress={() => navigation.getParent()?.navigate('FieldEntry')} secondary />
  </Page>;
}

function alertTitle(alert: AlertItem) {
  return `${alert.parameter} · ${alert.severity}`;
}

export function AlertsScreen({ navigation }: Props<'Alerts'>) {
  const { colors } = useTheme();
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
  const { colors } = useTheme();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const alertQuery = useQuery({ queryKey: ['alert-detail', route.params.alertId], queryFn: async () => (await api.listAlerts()).find((item) => item.id === route.params.alertId) ?? null });
  const responses = useQuery({ queryKey: ['alert-responses', route.params.alertId], queryFn: () => api.listAlertResponses(route.params.alertId) });
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: async (status: 'acknowledge' | 'resolve') => {
      const issues = validateAcknowledgeNote(note);
      if (issues.length) throw new Error(issues[0].message);
      const input = { note: note.trim(), user: user?.name ?? 'Mobile user' };
      if (status === 'acknowledge') return api.acknowledgeAlert(route.params.alertId, input);
      const resolved = await api.resolveAlert(route.params.alertId, input);
      await api.createActivityLog({
        tankId: resolved.tankId,
        kind: 'ALERT RESOLUTION',
        type: `Resolved: ${resolved.parameter}`,
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
      {responses.isLoading ? <StateMessage message="Loading responses…" loading /> : responses.isError ? <><StateMessage message={`Could not load responses: ${responses.error.message}`} /><Button label="Retry responses" secondary onPress={() => void responses.refetch()} /></> : (responses.data ?? []).length === 0 ? <Text style={{ color: colors.muted }}>No responses recorded.</Text> : responses.data?.map((response) => <Text key={response.id} style={{ color: colors.muted }}>{response.status} · {response.createdBy} · {formatManilaDateTime(response.createdAt)} PHT · {response.note}</Text>)}
    </Card>}
  </Page>;
}

export function TrendsScreen() {
  const { colors } = useTheme();
  const { tankId } = useTankSelection();
  const from = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), []);
  const readings = useQuery({ queryKey: ['mobile-trends', tankId], queryFn: () => api.listReadings({ tankId, from }), enabled: Boolean(tankId) });
  const data = [...(readings.data ?? [])].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((row, index) => ({ value: row.doMgL, label: index % 2 === 0 ? new Date(row.timestamp).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) : '' }));
  return <Page>
    <Title detail="Latest 24 hours · 3-hour sampling cadence">Trends</Title>
    <TankPicker />
    {readings.isLoading ? <StateMessage message="Loading trend data…" loading /> : readings.isError ? <StateMessage message="Could not load trends." /> : data.length < 2 ? <StateMessage message="Not enough readings to draw a trend." /> : <Card title="Dissolved oxygen · mg/L">
      <ScrollView horizontal showsHorizontalScrollIndicator><LineChart data={data} width={300} height={180} spacing={50} color={colors.teal} thickness={3} dataPointsColor={colors.teal} yAxisTextStyle={{ color: colors.muted }} xAxisLabelTextStyle={{ color: colors.muted, fontSize: 10 }} /></ScrollView>
      <Text style={{ color: colors.muted }}>Trend view is informational; review each point alongside configured thresholds and alert history.</Text>
    </Card>}
  </Page>;
}

export function HistoryScreen() {
  const { colors } = useTheme();
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

export function ManagerReviewScreen() {
  const { user } = useSession();
  const allowed = canAccess(user?.role ?? null, 'validation');
  const rows = useQuery({ queryKey: ['validation'], queryFn: () => api.listValidationRows(), enabled: allowed });
  const tolerances = useQuery({ queryKey: ['validation-tolerances'], queryFn: () => api.getValidationTolerances(), enabled: allowed });
  if (!allowed) return <Page><StateMessage message="You do not have access to validation." /></Page>;
  return <Page>
    <Title detail="Compare sensor averages with reference measurements">Manager review</Title>
    {rows.isLoading || tolerances.isLoading ? <StateMessage message="Loading validation…" loading /> :
      rows.isError || tolerances.isError ? <Card><StateMessage message={`Could not load validation: ${(rows.error ?? tolerances.error)?.message ?? 'Unknown error'}`} /><Button label="Retry" secondary onPress={() => { void rows.refetch(); void tolerances.refetch(); }} /></Card> :
      !rows.data?.length || !tolerances.data ? <StateMessage message="No validation comparisons are available." /> :
      rows.data.map((row, index) => {
        const key = row.parameter.toLowerCase().includes('temp') ? 'temperature' : row.parameter.toLowerCase().includes('ph') ? 'ph' : 'do';
        const tolerance = tolerances.data[key];
        const difference = row.hydrosenseMean - row.reference;
        const percent = row.reference === 0 ? 0 : Number((Math.abs(difference) / Math.abs(row.reference) * 100).toFixed(2));
        return <Card key={`${row.parameter}-${index}`} title={row.parameter}>
          <DataRow label="Sensor mean" value={`${row.hydrosenseMean}`} />
          <DataRow label="Reference" value={`${row.reference}`} />
          <DataRow label="Error" value={`${Number(difference.toFixed(3))} (${percent}%)`} />
          <DataRow label="Tolerance" value={`±${tolerance}`} />
          <DataRow label="Result" value={Math.abs(difference) <= tolerance ? 'Pass' : 'Fail'} />
        </Card>;
      })}
  </Page>;
}

export function AdminReviewScreen({ navigation }: Props<'Review'>) {
  const { colors } = useTheme();
  const { user } = useSession();
  const allowed = canAccess(user?.role ?? null, 'admin');
  const queryClient = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role | undefined>>({});
  const pending = useQuery({ queryKey: ['pending-accounts'], queryFn: listPendingAccounts, enabled: allowed && DATA_MODE === 'api' });
  const review = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role | null }) => reviewPendingAccount(id, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-accounts'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api.listUsers(), enabled: allowed });
  const logs = useQuery({ queryKey: ['audit-logs'], queryFn: () => api.listAuditLogs(), enabled: allowed });
  if (!allowed) return <Page><StateMessage message="You do not have access to administration." /></Page>;
  return <Page>
    <Title detail="Review account requests and audit events">Admin overview</Title>
    <Button label="Review validation comparisons" secondary onPress={() => navigation.getParent()?.navigate('ValidationReview')} />
    <Card title="Pending requests">
      {DATA_MODE === 'mock' ? <StateMessage message="Account review is unavailable in mobile demo mode. Connect to the backend to review requests." /> :
        pending.isLoading ? <StateMessage message="Loading requests…" loading /> : pending.isError ? <><StateMessage message={`Could not load requests: ${pending.error.message}`} /><Button label="Retry requests" secondary onPress={() => void pending.refetch()} /></> :
          !pending.data?.length ? <StateMessage message="No account requests are awaiting review." /> : pending.data.map((account) => <View key={account.id} style={{ gap: 8, paddingVertical: 10 }}>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>{account.firstName} {account.lastName}</Text>
            <Text style={{ color: colors.muted }}>{account.email} · {account.employeeId ?? '—'}</Text>
            <Text style={{ color: colors.ink }}>Choose an approval role:</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['operator', 'manager', 'admin'] as const).map((role) => <Pressable key={role} accessibilityRole="radio" accessibilityState={{ checked: selectedRoles[account.id] === role }} onPress={() => setSelectedRoles((current) => ({ ...current, [account.id]: role }))}
                style={{ padding: 10, borderWidth: 1, borderRadius: 10, borderColor: selectedRoles[account.id] === role ? colors.teal : colors.border, backgroundColor: selectedRoles[account.id] === role ? colors.selected : colors.surface }}>
                <Text style={{ color: colors.ink }}>{role[0].toUpperCase() + role.slice(1)}</Text>
              </Pressable>)}
            </View>
            <Button label="Approve" disabled={!selectedRoles[account.id] || review.isPending} onPress={() => { const role = selectedRoles[account.id]; if (role) review.mutate({ id: account.id, role }); }} />
            <Button label="Reject" secondary disabled={review.isPending} onPress={() => review.mutate({ id: account.id, role: null })} />
          </View>)}
      {review.isError && <StateMessage message={`Could not review request: ${review.error.message}`} />}
    </Card>
    <Card title="Accounts">
      {users.isLoading ? <StateMessage message="Loading accounts…" loading /> : users.isError ? <><StateMessage message={`Could not load accounts: ${users.error.message}`} /><Button label="Retry accounts" secondary onPress={() => void users.refetch()} /></> : !users.data?.length ? <StateMessage message="No accounts found." /> : users.data.map((account) => <DataRow key={account.id} label={account.name || account.email} value={account.role ?? 'Unassigned'} detail={account.email} />)}
    </Card>
    <Card title="Recent audit events">
      {logs.isLoading ? <StateMessage message="Loading audit events…" loading /> : logs.isError ? <><StateMessage message={`Could not load audit events: ${logs.error.message}`} /><Button label="Retry events" secondary onPress={() => void logs.refetch()} /></> : !logs.data?.length ? <StateMessage message="No audit events found." /> : logs.data.slice(0, 20).map((log) => <View key={log.id} style={{ gap: 4, paddingVertical: 8 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{log.action} · {log.user}</Text><Text style={{ color: colors.muted }}>{formatManilaDateTime(log.timestamp)} PHT · {log.detail}</Text></View>)}
    </Card>
  </Page>;
}

export function SettingsScreen({ navigation }: Props<'Settings'>) {
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  const { user, signOut } = useSession();
  const { tankId } = useTankSelection();
  const thresholdsQuery = useQuery({ queryKey: ['thresholds'], queryFn: () => api.listThresholds() });
  const thresholds = thresholdsQuery.data ?? [];
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Threshold[]>([]);
  const canEdit = canAccess(user?.role ?? null, 'thresholds');
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
      setDrafts([]);
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
    <Card title="Appearance">
      <Button label="Choose theme" secondary onPress={() => navigation.getParent()?.navigate('Appearance')} />
    </Card>
    <Card title="Field tools">
      <Button label="Calibration helper" secondary onPress={() => navigation.getParent()?.navigate('Calibration')} />
      <Button label="Manual salinity / ammonia entry" secondary onPress={() => navigation.getParent()?.navigate('FieldEntry')} />
      <Button label="Export report" secondary onPress={() => navigation.getParent()?.navigate('Export')} />
    </Card>
    {canEdit && <Card title="Thresholds">
      {thresholdsQuery.isLoading ? <StateMessage message="Loading thresholds…" loading /> : thresholdsQuery.isError ? <><StateMessage message={`Could not load thresholds: ${thresholdsQuery.error.message}`} /><Button label="Retry thresholds" secondary onPress={() => void thresholdsQuery.refetch()} /></> : <>
      {(['temperature', 'do', 'ph'] as const).map((parameter) => {
        const row = (drafts.length ? drafts : thresholds).find((item) => item.parameter === parameter);
        return <View key={parameter} style={{ gap: 6, marginBottom: 8 }}>
          <Text style={ui.label}>{parameter === 'do' ? 'Dissolved oxygen' : parameter}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[ui.input, { flex: 1 }]} keyboardType="numeric" placeholder="Minimum" placeholderTextColor={colors.muted} value={row?.min === undefined ? '' : String(row.min)} onChangeText={(value) => updateThreshold(parameter, 'min', value)} />
            <TextInput style={[ui.input, { flex: 1 }]} keyboardType="numeric" placeholder="Maximum" placeholderTextColor={colors.muted} value={row?.max === undefined ? '' : String(row.max)} onChangeText={(value) => updateThreshold(parameter, 'max', value)} />
          </View>
        </View>;
      })}
      <Button label="Save thresholds" disabled={mutation.isPending || !drafts.length} onPress={() => mutation.mutate()} />
      {mutation.isError && <Text style={{ color: colors.critical }}>{mutation.error.message}</Text>}
      </>}
    </Card>}
    <Button label="Sign out" secondary onPress={() => void signOut().catch((error: unknown) => Alert.alert('Sign-out cleanup issue', error instanceof Error ? error.message : 'Some local data could not be cleared.'))} />
    <Text style={{ color: colors.muted, fontSize: 12 }}>Mode: {DATA_MODE} · Tank: {tankId}</Text>
  </Page>;
}

const themeOptions: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting' },
  { value: 'light', label: 'Light', hint: 'Light background' },
  { value: 'dark', label: 'Dark', hint: 'Dark background, easier to read at night' },
];

export function AppearanceScreen() {
  const { choice, setChoice, colors, error } = useTheme();
  return <Page>
    <Title detail="Choose how HydroSense looks on this device">Appearance</Title>
    <Card title="Theme">
      {themeOptions.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: choice === option.value }} onPress={() => void setChoice(option.value)}
        style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: choice === option.value ? colors.selected : colors.surface, borderWidth: 1, borderColor: choice === option.value ? colors.teal : colors.border }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: choice === option.value ? colors.teal : colors.muted, alignItems: 'center', justifyContent: 'center' }}>
          {choice === option.value && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal }} />}
        </View>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{option.label}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{option.hint}</Text></View>
      </Pressable>)}
      {error && <Text accessibilityRole="alert" style={{ color: colors.critical }}>{error}</Text>}
    </Card>
  </Page>;
}

export function CalibrationScreen() {
  const { colors } = useTheme();
  const { tankId } = useTankSelection();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [parameter, setParameter] = useState<'ph' | 'do'>('ph');
  const [standard, setStandard] = useState('');
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      if (!tankId || !standard.trim() || !before.trim() || !after.trim() || !Number.isFinite(Number(before)) || !Number.isFinite(Number(after))) throw new Error('Choose a tank and enter a standard plus before/after readings.');
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
  if (online) return null;
  return <View style={{ position: 'absolute', top: 48, left: 0, right: 0, zIndex: 100, backgroundColor: colors.offline, paddingHorizontal: 14, paddingVertical: 9 }}><Text style={{ color: colors.warning, fontWeight: '800' }}>Offline · showing cached data when available</Text></View>;
}
