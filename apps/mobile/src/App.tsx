import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import type { LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onlineManager } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import type { MainTabParamList, RootStackParamList } from './navigation';
import {
  AlertDetailScreen,
  AlertsScreen,
  CalibrationScreen,
  ConnectionNotice,
  ExportScreen,
  FieldEntryScreen,
  HistoryScreen,
  HomeScreen,
  LoginScreen,
  SettingsScreen,
  StatusScreen,
  TrendsScreen,
} from './screens';
import { useSession, SessionProvider, TankProvider } from './state';
import { colors } from './components/ui';
import { api, liveClient } from './services/client';
import { queryClient, queryPersister } from './services/queryClient';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => {
  setOnline(Boolean(state.isConnected));
}));

Notifications.setNotificationHandler({
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
  return <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.teal, tabBarLabelStyle: { fontWeight: '700' } }}>
    <Tabs.Screen name="Home" component={HomeScreen} />
    <Tabs.Screen name="Alerts" component={AlertsScreen} />
    <Tabs.Screen name="Trends" component={TrendsScreen} />
    <Tabs.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
    <Tabs.Screen name="Status" component={StatusScreen} />
    <Tabs.Screen name="Settings" component={SettingsScreen} />
  </Tabs.Navigator>;
}

function LiveSync() {
  const { user } = useSession();
  useEffect(() => {
    if (!user) return undefined;
    liveClient.connect();
    let active = true;
    const subscriptions: Array<() => void> = [];
    api.listTanks().then((tanks) => {
      if (!active) return;
      tanks.forEach((tank) => {
        subscriptions.push(liveClient.subscribe(tank.id, (event) => {
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
      liveClient.disconnect();
    };
  }, [user]);
  return null;
}

function NotificationNavigation() {
  useEffect(() => {
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
  const { user, ready } = useSession();
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected))), []);
  useEffect(() => {
    if (!user) return;
    void Notifications.requestPermissionsAsync().catch((error: unknown) => {
      console.error('Could not request notification permission.', error);
    });
  }, [user]);
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.teal} /></View>;
  return <>
    <NavigationContainer ref={navigationRef} linking={linking}>
      <StatusBar style="auto" />
      <LiveSync />
      <NotificationNavigation />
      <Stack.Navigator>
        {!user ? <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} /> : <>
          <Stack.Screen name="Main" component={MainTabs} options={{ title: 'HydroSense' }} />
          <Stack.Screen name="AlertDetail" component={AlertDetailScreen} options={{ title: 'Alert detail' }} />
          <Stack.Screen name="Calibration" component={CalibrationScreen} options={{ title: 'Calibration' }} />
          <Stack.Screen name="FieldEntry" component={FieldEntryScreen} options={{ title: 'Field entry' }} />
          <Stack.Screen name="Export" component={ExportScreen} options={{ title: 'Export' }} />
        </>}
      </Stack.Navigator>
    </NavigationContainer>
    <ConnectionNotice online={online} />
  </>;
}

export default function App() {
  return <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}>
    <SessionProvider>
      <TankProvider>
        <AppNavigation />
      </TankProvider>
    </SessionProvider>
  </PersistQueryClientProvider>;
}
