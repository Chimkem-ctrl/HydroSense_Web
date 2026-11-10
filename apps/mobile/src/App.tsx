import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { DarkTheme as NavigationDarkTheme, DefaultTheme as NavigationLightTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { Activity, AlertTriangle, Database, LayoutDashboard, Wifi } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isBottomBarRoute } from './navigation';
import type { BottomBarRoute, MainTabParamList, RootStackParamList } from './navigation';
import {
  AlertDetailScreen,
  AlertsScreen,
  AppearanceScreen,
  CalibrationScreen,
  ConnectionNotice,
  ExportScreen,
  FieldEntryScreen,
  HistoryScreen,
  HomeScreen,
  AdminReviewScreen,
  ManagerReviewScreen,
  SettingsScreen,
  StatusScreen,
  TrendsScreen,
} from './screens';
import { LoginScreen, SignUpScreen, PendingApprovalScreen, ForgotPasswordScreen } from './authScreens';
import { useSession, SessionProvider, TankProvider } from './state';
import { ThemeProvider, useTheme } from './theme';
import { HeaderToolbar } from './components/HeaderToolbar';
import { api, liveClient } from './services/client';
import { queryClient, queryPersister } from './services/queryClient';
import { canAccess } from './access';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => {
  setOnline(Boolean(state.isConnected));
}));

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['hydrosense://'],
  config: { screens: { AlertDetail: 'alerts/:alertId' } },
};

function MainTabs() {
  const { user } = useSession();
  return <Tabs.Navigator tabBar={(props) => <MobileTabBar {...props} />} screenOptions={{ header: (props) => <HeaderToolbar {...props} /> }}>
    <Tabs.Screen name="Home" component={HomeScreen} />
    <Tabs.Screen name="Alerts" component={AlertsScreen} />
    <Tabs.Screen name="Trends" component={TrendsScreen} />
    {canAccess(user?.role ?? null, 'history') && <Tabs.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />}
    <Tabs.Screen name="Status" component={StatusScreen} />
    {user?.role === 'manager' && <Tabs.Screen name="Review" component={ManagerReviewScreen} options={{ title: 'Review' }} />}
    {user?.role === 'admin' && <Tabs.Screen name="Review" component={AdminReviewScreen} options={{ title: 'Admin' }} />}
    <Tabs.Screen name="Settings" component={SettingsScreen} />
  </Tabs.Navigator>;
}

const tabIcons = {
  Home: LayoutDashboard,
  Alerts: AlertTriangle,
  Trends: Activity,
  History: Database,
  Status: Wifi,
} satisfies Record<BottomBarRoute, typeof Activity>;

function MobileTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }}>
    <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6, gap: 2 }}>
      {state.routes.map((route, index) => {
        if (!isBottomBarRoute(route.name)) return null;
        const selected = state.index === index;
        const options = descriptors[route.key].options;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const Icon = tabIcons[route.name];
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
          onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          }}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          style={{ flex: 1, minHeight: 55, alignItems: 'center', justifyContent: 'center', borderRadius: 16, gap: 3, backgroundColor: selected ? colors.selected : 'transparent' }}>
          <Icon size={20} color={selected ? colors.teal : colors.muted} strokeWidth={2} />
          <Text style={{ fontSize: 11, fontWeight: selected ? '700' : '500', color: selected ? colors.teal : colors.muted }}>{label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function LiveSync() {
  const { user } = useSession();
  useEffect(() => {
    const client = liveClient;
    if (!user || !client) return undefined;
    client.connect();
    let active = true;
    const subscriptions: Array<() => void> = [];
    api.listTanks().then((tanks) => {
      if (!active) return;
      tanks.forEach((tank) => {
        subscriptions.push(client.subscribe(tank.id, (event) => {
          if (event.type === 'reading') {
            queryClient.setQueryData(['latest-reading', tank.id], event.reading);
            void queryClient.invalidateQueries({ queryKey: ['mobile-trends', tank.id] });
            void queryClient.invalidateQueries({ queryKey: ['mobile-history', tank.id] });
          } else {
            void queryClient.invalidateQueries({ queryKey: ['device-statuses'] });
          }
        }));
      });
    }).catch((error: unknown) => console.error('Could not subscribe to live tank updates.', error));
    return () => {
      active = false;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
    };
  }, [user]);
  return null;
}

function NotificationNavigation() {
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const openAlert = (response: Notifications.NotificationResponse | null) => {
      const alertId = response?.notification.request.content.data?.alertId;
      if (typeof alertId !== 'string') return;
      if (navigationRef.isReady()) navigationRef.navigate('AlertDetail', { alertId });
    };
    void Notifications.getLastNotificationResponseAsync().then(openAlert).catch((error: unknown) => {
      console.error('Could not read the initial notification response.', error);
    });
    const subscription = Notifications.addNotificationResponseReceivedListener(openAlert);
    return () => subscription.remove();
  }, []);
  return null;
}

function AppNavigation() {
  const { colors, mode } = useTheme();
  const { user, ready } = useSession();
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))), []);
  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    void Notifications.requestPermissionsAsync().catch((error: unknown) => {
      console.error('Could not request notification permission.', error);
    });
  }, [user]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.teal} /></View>;
  return <>
    <NavigationContainer ref={navigationRef} linking={linking} theme={{ ...(mode === 'dark' ? NavigationDarkTheme : NavigationLightTheme), colors: { ...(mode === 'dark' ? NavigationDarkTheme : NavigationLightTheme).colors, primary: colors.teal, background: colors.canvas, card: colors.surface, text: colors.ink, border: colors.border } }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <LiveSync />
      <NotificationNavigation />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.canvas }, headerTintColor: colors.ink, headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}>
        {!user ? <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Request an account' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset your password' }} />
          <Stack.Screen name="PendingApproval" component={PendingApprovalScreen} options={{ title: 'Account request' }} />
        </> : <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ title: 'Appearance' }} />
          <Stack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: 'Alert detail' }} />
          <Stack.Screen name="Calibration" component={CalibrationScreen} options={{ title: 'Calibration' }} />
          <Stack.Screen name="FieldEntry" component={FieldEntryScreen} options={{ title: 'Field entry' }} />
          <Stack.Screen name="Export" component={ExportScreen} options={{ title: 'Export' }} />
          {canAccess(user.role, 'validation') && <Stack.Screen name="ValidationReview" component={ManagerReviewScreen} options={{ title: 'Validation review' }} />}
        </>}
      </Stack.Navigator>
    </NavigationContainer>
    <ConnectionNotice online={online} />
  </>;
}

export default function App() {
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}

function ThemedApp() {
  const { colors, mode } = useTheme();
  const paperTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return <PaperProvider theme={{ ...paperTheme, colors: { ...paperTheme.colors, primary: colors.teal, background: colors.canvas, surface: colors.surface, onSurface: colors.ink, onSurfaceVariant: colors.muted } }}><PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}>
    <SessionProvider>
      <TankProvider>
        <AppNavigation />
      </TankProvider>
    </SessionProvider>
  </PersistQueryClientProvider></PaperProvider>;
}
