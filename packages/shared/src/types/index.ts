export type Level = 'normal' | 'warning' | 'critical';
export type Advisory = 'low' | 'watch' | 'high';
export type Role = 'operator' | 'manager' | 'admin';
export type MeasuredParameter = 'temperature' | 'do' | 'ph';

export interface Reading {
  id: string;
  tankId: string;
  timestamp: string;
  temperature: number;
  doMgL: number;
  ph: number;
}

export interface Tank {
  id: string;
  name: string;
  site: string;
  rearingStartDate: string;
  deviceId: string;
}

export interface DeviceStatus {
  deviceId: string;
  online: boolean;
  lastSeen: string;
  batteryPct: number;
  powerSource: 'solar' | 'grid' | 'battery';
  wifiRssi: number;
  pendingSyncCount: number;
}

export interface Threshold {
  parameter: MeasuredParameter;
  min?: number;
  max?: number;
}

export interface AdvisoryState {
  kind: 'salinity' | 'ammonia';
  level: Advisory;
  inputs: Record<string, string | number>;
  firedRule: string;
  updatedAt: string;
}

export interface AdvisoryRuleSettings {
  salinityWatchTemperatureC: number;
  salinityHighTemperatureC: number;
  ammoniaWatchTemperatureC: number;
  ammoniaHighPh: number;
}

export interface AlertItem {
  id: string;
  tankId: string;
  parameter: string;
  value: number;
  threshold: string;
  severity: 'warning' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  note?: string;
}

export interface AlertResponse {
  id: string;
  alertId: string;
  status: AlertItem['status'];
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface ManualEntry {
  id: string;
  tankId: string;
  type: 'refractometer_salinity' | 'ammonia_test_kit' | 'rain_event' | 'freshwater_dosing';
  value?: number;
  unit?: string;
  timestamp: string;
  enteredBy: string;
  note?: string;
}

export type ActivityLogKind = 'OPERATION' | 'ENVIRONMENT' | 'ALERT RESOLUTION';

export interface ActivityLog {
  id: string;
  tankId: string | 'hatchery';
  kind: ActivityLogKind;
  type: string;
  occurredAt: string;
  operator: string;
  notes: string;
  waterChangePercent?: number;
  waterSource?: string;
  impact?: string;
  manualReadings?: {
    dissolvedOxygen?: number;
    temperature?: number;
    ph?: number;
    salinity?: number;
    ammonia?: number;
    method?: string;
  };
}

export interface CalibrationLog {
  id: string;
  tankId: string;
  parameter: 'ph' | 'do';
  standard: string;
  before: number;
  after: number;
  date: string;
  user: string;
  nextDue: string;
}

export interface ValidationRow {
  parameter: string;
  hydrosenseMean: number;
  reference: number;
  error: number;
  pctError: number;
  tolerance: number;
  pass: boolean;
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  site: string;
  active: boolean;
  lastActive: string;
  employeeId?: string;
  phone?: string;
  position?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

export interface ValidationTolerance {
  temperature: number;
  ph: number;
  do: number;
}

export type AlertStatus = AlertItem['status'];

export interface LiveReadingEvent {
  type: 'reading';
  tankId: string;
  emittedAt: string;
  reading: Reading;
}

export interface LiveDeviceEvent {
  type: 'device_status';
  tankId: string;
  emittedAt: string;
  status: DeviceStatus;
}

export type LiveEvent = LiveReadingEvent | LiveDeviceEvent;

export interface DateRange {
  from: string;
  to: string;
}
