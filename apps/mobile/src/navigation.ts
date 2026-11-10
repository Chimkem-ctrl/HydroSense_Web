export type MainTabParamList = {
  Home: undefined;
  Alerts: undefined;
  Trends: undefined;
  History: undefined;
  Status: undefined;
  Review: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  PendingApproval: undefined;
  Main: undefined;
  Appearance: undefined;
  AlertDetail: { alertId: string };
  Calibration: undefined;
  FieldEntry: undefined;
  Export: undefined;
  ValidationReview: undefined;
};
