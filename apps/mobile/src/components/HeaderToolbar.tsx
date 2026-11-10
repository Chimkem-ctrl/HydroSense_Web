import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';
import { Activity, AlertTriangle, Bell, ChevronDown, ClipboardList, Database, LayoutDashboard, LogOut, Menu, Palette as PaletteIcon, Settings, Waves, Wifi, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MainTabParamList } from '../navigation';
import { canAccess } from '../access';
import { api, liveClient } from '../services/client';
import { getConnectionLabel } from '../services/connectionStatus';
import { useSession, useTankSelection } from '../state';
import { Brand } from './ui';
import { useTheme } from '../theme';
import type { Palette } from '../theme';

type Panel = 'navigation' | 'tanks' | 'account' | null;
type Destination = { name: keyof MainTabParamList; label: string; icon: typeof Menu; group: 'Monitor' | 'Records' | 'Manage' };

export function HeaderToolbar({ navigation, route }: BottomTabHeaderProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, signOut } = useSession();
  const { tanks, tankId, setTankId, isLoading, error, refetch } = useTankSelection();
  const [panel, setPanel] = useState<Panel>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [connection, setConnection] = useState(liveClient?.getConnectionState() ?? 'disconnected');
  const alerts = useQuery({ queryKey: ['alerts', 'toolbar'], queryFn: () => api.listAlerts(), enabled: Boolean(user) });
  const latestReading = useQuery({ queryKey: ['latest-reading', tankId], queryFn: () => api.getLatestReading(tankId), enabled: Boolean(user && tankId) });
  const [, updateClock] = useState(0);
  const openAlerts = alerts.data?.filter((item) => item.status === 'open').length;
  const tank = tanks.find((item) => item.id === tankId);

  useEffect(() => NetInfo.addEventListener((state) => setOnline(state.isConnected)), []);
  useEffect(() => liveClient?.subscribeConnection(setConnection), []);
  useEffect(() => { setPanel(null); }, [route.key]);
  useEffect(() => {
    const timer = setInterval(() => updateClock((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const destinations: Destination[] = [
    { name: 'Home', label: 'Live monitor', icon: LayoutDashboard, group: 'Monitor' },
    { name: 'Status', label: 'System health', icon: Wifi, group: 'Monitor' },
    { name: 'Trends', label: 'Trends', icon: Activity, group: 'Monitor' },
    { name: 'Alerts', label: 'Alerts center', icon: AlertTriangle, group: 'Monitor' },
    ...(canAccess(user?.role ?? null, 'history') ? [{ name: 'History', label: 'Historical logs', icon: Database, group: 'Records' } satisfies Destination] : []),
    ...(user?.role === 'manager' || user?.role === 'admin' ? [{ name: 'Review', label: user.role === 'admin' ? 'Admin overview' : 'Validation review', icon: ClipboardList, group: 'Manage' } satisfies Destination] : []),
    { name: 'Settings', label: 'Settings', icon: Settings, group: 'Manage' },
  ];
  const connectionLabel = getConnectionLabel(online, connection, latestReading.data?.timestamp, Date.now());
  const initials = user?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? '';

  function goTo(name: keyof MainTabParamList) {
    setPanel(null);
    navigation.navigate(name);
  }

  async function handleSignOut() {
    setPanel(null);
    try {
      await signOut();
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Some local data could not be cleared.';
      console.error('Sign-out cleanup issue:', failure);
      Alert.alert('Sign-out cleanup issue', message);
    }
  }

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" accessibilityState={{ expanded: panel === 'navigation' }} onPress={() => setPanel('navigation')} style={styles.iconButton}><Menu size={21} color={colors.ink} /></Pressable>
        <View style={styles.brandSlot}><Brand compact /></View>
        <Pressable accessibilityRole="button" accessibilityLabel={alerts.isError ? 'Alerts unavailable; open alerts' : openAlerts === undefined ? 'Loading alerts; open alerts' : `${openAlerts} open alerts`} onPress={() => goTo('Alerts')} style={styles.iconButton}>
          <Bell size={20} color={colors.ink} />
          {openAlerts !== undefined && openAlerts > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{openAlerts > 99 ? '99+' : openAlerts}</Text></View>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Account menu for ${user?.name ?? 'user'}`} accessibilityState={{ expanded: panel === 'account' }} onPress={() => setPanel('account')} style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></Pressable>
      </View>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Select tank: ${tank?.name ?? (isLoading ? 'loading' : error ? 'unavailable' : 'none')}`} accessibilityState={{ expanded: panel === 'tanks' }} onPress={() => setPanel('tanks')} style={styles.tankButton}>
          <Waves size={16} color={colors.teal} /><Text numberOfLines={1} style={styles.tankText}>{tank?.name ?? (isLoading ? 'Loading tanks…' : error ? 'Tanks unavailable' : 'Select tank')}</Text><ChevronDown size={16} color={colors.muted} />
        </Pressable>
        <View accessibilityLabel={`Connection ${connectionLabel}`} style={styles.connection}>
          <View style={[styles.dot, { backgroundColor: connectionLabel === 'Live' ? '#16a34a' : colors.warning }]} />
          <Text style={styles.connectionText}>{connectionLabel}</Text>
        </View>
      </View>
      {alerts.isError && <Text style={styles.error}>Could not load alert count. Open alerts to retry.</Text>}
    </View>
    <Modal visible={panel !== null} transparent animationType="fade" onRequestClose={() => setPanel(null)}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setPanel(null)} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top', 'bottom']} style={[styles.panel, panel !== 'navigation' && styles.sheet]}>
          <View style={styles.panelHeader}><Text style={styles.panelTitle}>{panel === 'navigation' ? 'Navigation' : panel === 'tanks' ? 'Select tank' : 'Account'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => setPanel(null)} style={styles.close}><X size={20} color={colors.ink} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.panelContent}>
            {panel === 'navigation' && <>
              <Brand compact />
              {(['Monitor', 'Records', 'Manage'] as const).map((group) => {
                const items = destinations.filter((item) => item.group === group);
                return items.length ? <View key={group} style={styles.group}>
                  <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
                  {items.map((item) => <Pressable key={item.name} accessibilityRole="button" accessibilityState={{ selected: route.name === item.name }} onPress={() => goTo(item.name)} style={[styles.menuItem, route.name === item.name && styles.selected]}>
                    <item.icon size={19} color={route.name === item.name ? colors.teal : colors.muted} /><Text style={[styles.itemText, route.name === item.name && styles.selectedText]}>{item.label}</Text>
                  </Pressable>)}
                </View> : null;
              })}
            </>}
            {panel === 'tanks' && (isLoading ? <Text style={styles.description}>Loading tanks…</Text> : error ? <><Text accessibilityRole="alert" style={styles.error}>Could not load tanks: {error.message}</Text><Pressable accessibilityRole="button" onPress={refetch} style={styles.menuItem}><Text style={styles.selectedText}>Retry tank list</Text></Pressable></> : !tanks.length ? <Text style={styles.description}>No tanks are available for this account.</Text> : tanks.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ checked: item.id === tankId }} onPress={() => { setTankId(item.id); setPanel(null); }} style={[styles.menuItem, item.id === tankId && styles.selected]}><Waves size={19} color={colors.teal} /><View style={{ flex: 1 }}><Text style={styles.itemText}>{item.name}</Text><Text style={styles.description}>{item.site}</Text></View>{item.id === tankId && <Text style={styles.selectedText}>Selected</Text>}</Pressable>))}
            {panel === 'account' && <>
              <Text style={styles.panelTitle}>{user?.name}</Text><Text style={styles.description}>{user?.role}</Text>
              <Pressable accessibilityRole="button" onPress={() => { setPanel(null); navigation.getParent()?.navigate('Appearance'); }} style={styles.menuItem}><PaletteIcon size={19} color={colors.muted} /><Text style={styles.itemText}>Appearance</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => goTo('Settings')} style={styles.menuItem}><Settings size={19} color={colors.muted} /><Text style={styles.itemText}>Settings</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => void handleSignOut()} style={styles.menuItem}><LogOut size={19} color={colors.critical} /><Text style={[styles.itemText, { color: colors.critical }]}>Sign out</Text></Pressable>
            </>}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const createStyles = (colors: Palette) => StyleSheet.create({
  safe: { backgroundColor: colors.canvas },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandSlot: { flex: 1, minWidth: 0, overflow: 'hidden' },
  iconButton: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, backgroundColor: colors.selected, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.teal, fontWeight: '800', fontSize: 13 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 20, height: 20, paddingHorizontal: 3, borderRadius: 10, backgroundColor: '#b51c1c', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: 'white', fontWeight: '700', fontSize: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tankButton: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14 },
  tankText: { flex: 1, color: colors.ink, fontWeight: '700', fontSize: 13 },
  connection: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  connectionText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  error: { color: colors.critical, fontSize: 13, lineHeight: 19 },
  overlay: { flex: 1, backgroundColor: colors.overlay, flexDirection: 'row' },
  panel: { backgroundColor: colors.surface, width: '85%', maxWidth: 340 },
  sheet: { alignSelf: 'flex-end', width: '100%', maxWidth: undefined, maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  panelHeader: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  panelTitle: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  panelContent: { padding: 20, gap: 12 },
  group: { gap: 4, marginTop: 8 },
  groupLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8 },
  menuItem: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14 },
  selected: { backgroundColor: colors.selected },
  itemText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  selectedText: { color: colors.teal, fontWeight: '700', fontSize: 13 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
