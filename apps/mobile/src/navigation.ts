export type MainTabParamList = {
  Home: undefined;
  Alerts: undefined;
  Trends: undefined;
  History: undefined;
  Status: undefined;
  Review: undefined;
  Settings: undefined;
};

export const bottomBarRoutes = ['Home', 'Alerts', 'Trends', 'History', 'Status'] as const satisfies readonly (keyof MainTabParamList)[];
export type BottomBarRoute = (typeof bottomBarRoutes)[number];

export function isBottomBarRoute(name: string): name is BottomBarRoute {
  return bottomBarRoutes.some((route) => route === name);
}

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
