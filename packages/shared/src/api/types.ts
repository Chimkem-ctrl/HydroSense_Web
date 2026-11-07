import type {
  AdvisoryRuleSettings,
  AdvisoryState,
  AlertItem,
  AlertResponse,
  AuditLog,
  CalibrationLog,
  DashboardUser,
  DateRange,
  DeviceStatus,
  ManualEntry,
  MeasuredParameter,
  Reading,
  Tank,
  Threshold,
  ValidationRow,
  ValidationTolerance,
} from '../types';

export interface ReadingQuery extends Partial<DateRange> {
  tankId?: string;
  parameter?: MeasuredParameter | 'all';
  limit?: number;
}

export interface AcknowledgeAlertInput {
  note: string;
  user: string;
}

export interface CreateCalibrationInput extends Omit<CalibrationLog, 'id'> {}

export interface HydroSenseApi {
  listTanks(): Promise<Tank[]>;
  createTank(tank: Omit<Tank, 'id'>, changedBy: string): Promise<Tank>;
  deleteTank(tankId: string, changedBy: string): Promise<void>;
  listReadings(query?: ReadingQuery): Promise<Reading[]>;
  getLatestReading(tankId: string): Promise<Reading | null>;
  listDeviceStatuses(): Promise<DeviceStatus[]>;
  listAlerts(tankId?: string): Promise<AlertItem[]>;
  listAlertResponses(alertId: string): Promise<AlertResponse[]>;
  acknowledgeAlert(alertId: string, input: AcknowledgeAlertInput): Promise<AlertItem>;
  resolveAlert(alertId: string, input: AcknowledgeAlertInput): Promise<AlertItem>;
  listManualEntries(tankId?: string): Promise<ManualEntry[]>;
  createManualEntry(entry: Omit<ManualEntry, 'id' | 'timestamp'>): Promise<ManualEntry>;
  listThresholds(): Promise<Threshold[]>;
  updateThresholds(thresholds: Threshold[], changedBy: string): Promise<Threshold[]>;
  getAdvisorySettings(): Promise<AdvisoryRuleSettings>;
  updateAdvisorySettings(settings: AdvisoryRuleSettings, changedBy: string): Promise<AdvisoryRuleSettings>;
  listAdvisories(tankId: string): Promise<AdvisoryState[]>;
  listCalibrationLogs(tankId?: string): Promise<CalibrationLog[]>;
  createCalibrationLog(log: CreateCalibrationInput): Promise<CalibrationLog>;
  listValidationRows(tankId?: string): Promise<ValidationRow[]>;
  getValidationTolerances(): Promise<ValidationTolerance>;
  updateValidationTolerances(tolerances: ValidationTolerance, changedBy: string): Promise<ValidationTolerance>;
  listUsers(): Promise<DashboardUser[]>;
  updateUserRole(userId: string, role: DashboardUser['role'], changedBy: string): Promise<DashboardUser>;
  listAuditLogs(): Promise<AuditLog[]>;
}
