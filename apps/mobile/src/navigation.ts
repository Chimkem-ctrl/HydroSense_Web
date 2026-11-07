export type MainTabParamList = {
  Home: undefined;
  Alerts: undefined;
  Trends: undefined;
  History: undefined;
  Status: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  AlertDetail: { alertId: string };
  Calibration: undefined;
  FieldEntry: undefined;
  Export: undefined;
};
