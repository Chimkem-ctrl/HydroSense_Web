import type {
  AdvisoryState,
  AlertItem,
  AlertResponse,
  AuditLog,
  CalibrationLog,
  DashboardUser,
  DeviceStatus,
  ManualEntry,
  Reading,
  Tank,
  Threshold,
  ValidationRow,
} from '../types';
import { DEFAULT_THRESHOLDS } from '../rules/status';
import { getAmmoniaAdvisory, getSalinityAdvisory } from '../rules/advisory';

const now = Date.now();
const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString();
const dateOnly = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

export const mockTanks: Tank[] = [
  { id: 'tank-a', name: 'Larval Tank A', site: 'Sagay Hatchery, Camiguin', rearingStartDate: dateOnly(11), deviceId: 'HS-MF-001' },
  { id: 'tank-b', name: 'Larval Tank B', site: 'Sagay Hatchery, Camiguin', rearingStartDate: dateOnly(19), deviceId: 'HS-MF-002' },
];

function createReadings(tank: Tank, tankIndex: number): Reading[] {
  const results: Reading[] = [];
  const latestHour = Math.floor(now / (3 * 3_600_000)) * 3;
  for (let index = 167; index >= 0; index -= 1) {
    const at = new Date((latestHour - index * 3) * 3_600_000);
    const hour = Number(new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', hour12: false }).format(at));
    const overnightDip = hour >= 22 || hour < 6 ? 0.65 : 0;
    const cycle = Math.sin(index / 8 + tankIndex) * 0.25;
    results.push({
      id: `${tank.id}-${at.toISOString()}`,
      tankId: tank.id,
      timestamp: at.toISOString(),
      temperature: Number((29.7 + Math.sin(index / 18 + tankIndex) * 1.25).toFixed(2)),
      doMgL: Number((6.4 + cycle - overnightDip + Math.sin(index / 5) * 0.25).toFixed(2)),
      ph: Number((7.15 + Math.sin(index / 20 + tankIndex) * 0.35).toFixed(2)),
    });
  }
  return results;
}

export const mockReadings: Reading[] = mockTanks.flatMap((tank, index) => createReadings(tank, index));

export const mockDevices: DeviceStatus[] = [
  { deviceId: 'HS-MF-001', online: true, lastSeen: iso(0), batteryPct: 86, powerSource: 'solar', wifiRssi: -58, pendingSyncCount: 0 },
  { deviceId: 'HS-MF-002', online: true, lastSeen: iso(1), batteryPct: 68, powerSource: 'grid', wifiRssi: -67, pendingSyncCount: 2 },
];

export const mockAlerts: AlertItem[] = [
  { id: 'alert-do-001', tankId: 'tank-a', parameter: 'Dissolved oxygen', value: 3.8, threshold: 'Minimum 4.0 mg/L', severity: 'warning', status: 'open', createdAt: iso(2) },
  { id: 'alert-temp-002', tankId: 'tank-b', parameter: 'Temperature', value: 32.4, threshold: 'Maximum 32.0°C', severity: 'critical', status: 'acknowledged', createdAt: iso(30), acknowledgedBy: 'Juan Dela Cruz', acknowledgedAt: iso(28), note: 'Verified against a handheld thermometer; checked again next sample.' },
  { id: 'alert-ph-003', tankId: 'tank-a', parameter: 'pH', value: 5.9, threshold: 'Minimum 6.0 pH', severity: 'warning', status: 'resolved', createdAt: iso(100), acknowledgedBy: 'Maria Santos', acknowledgedAt: iso(99), note: 'pH returned to range on verification reading.' },
];

export const mockAlertResponses: AlertResponse[] = [
  { id: 'response-temp-1', alertId: 'alert-temp-002', status: 'acknowledged', note: 'Verified against a handheld thermometer; checked again next sample.', createdAt: iso(28), createdBy: 'Juan Dela Cruz' },
  { id: 'response-ph-1', alertId: 'alert-ph-003', status: 'acknowledged', note: 'Checked with handheld pH meter.', createdAt: iso(99), createdBy: 'Maria Santos' },
  { id: 'response-ph-2', alertId: 'alert-ph-003', status: 'resolved', note: 'pH returned to range on verification reading.', createdAt: iso(96), createdBy: 'Maria Santos' },
];

export const mockManualEntries: ManualEntry[] = [
  { id: 'entry-1', tankId: 'tank-a', type: 'refractometer_salinity', value: 30.2, unit: 'ppt', timestamp: iso(10), enteredBy: 'Maria Santos', note: 'Morning check' },
  { id: 'entry-2', tankId: 'tank-b', type: 'rain_event', timestamp: iso(24), enteredBy: 'Juan Dela Cruz', note: 'Heavy rain overnight' },
  { id: 'entry-3', tankId: 'tank-a', type: 'ammonia_test_kit', value: 0.1, unit: 'mg/L', timestamp: iso(40), enteredBy: 'Maria Santos' },
];

export const mockCalibrationLogs: CalibrationLog[] = [
  { id: 'cal-1', tankId: 'tank-a', parameter: 'ph', standard: 'pH 7.00 buffer', before: 7.12, after: 7.01, date: iso(48), user: 'Maria Santos', nextDue: iso(-672) },
  { id: 'cal-2', tankId: 'tank-a', parameter: 'do', standard: 'Air-saturated water', before: 6.92, after: 7.04, date: iso(210), user: 'Juan Dela Cruz', nextDue: iso(6) },
  { id: 'cal-3', tankId: 'tank-b', parameter: 'ph', standard: 'pH 4.00 buffer', before: 4.08, after: 4.01, date: iso(8), user: 'Maria Santos', nextDue: iso(720) },
];

export const mockThresholds: Threshold[] = DEFAULT_THRESHOLDS;

export const mockAdvisoryStates: Record<string, AdvisoryState[]> = Object.fromEntries(
  mockTanks.map((tank, index) => {
    const tankReadings = mockReadings.filter((reading) => reading.tankId === tank.id);
    const latest = tankReadings[tankReadings.length - 1];
    const entries = mockManualEntries.filter((entry) => entry.tankId === tank.id);
    return [tank.id, [
      getSalinityAdvisory({
        temperatureC: latest.temperature,
        rainEvent: entries.some((entry) => entry.type === 'rain_event'),
        freshwaterDosing: entries.some((entry) => entry.type === 'freshwater_dosing'),
      }, undefined, iso(index)),
      getAmmoniaAdvisory({
        temperatureC: latest.temperature,
        ph: latest.ph,
        feedingLoad: index === 1 ? 'high' : 'usual',
      }, undefined, iso(index)),
    ]];
  }),
);

export const mockValidationRows: ValidationRow[] = [
  { parameter: 'Temperature (°C)', hydrosenseMean: 29.8, reference: 29.6, error: 0.2, pctError: 0.68, tolerance: 0.5, pass: true },
  { parameter: 'Dissolved oxygen (mg/L)', hydrosenseMean: 6.12, reference: 5.8, error: 0.32, pctError: 5.52, tolerance: 0.5, pass: true },
  { parameter: 'pH', hydrosenseMean: 7.22, reference: 7.5, error: 0.28, pctError: 3.73, tolerance: 0.2, pass: false },
];

export const mockUsers: DashboardUser[] = [
  { id: 'user-1', name: 'Juan Dela Cruz', email: 'juan@sagay-hatchery.ph', role: 'operator', site: mockTanks[0].site, active: true, lastActive: iso(1), employeeId: 'OP-2024-001', phone: '+63 917 555 0101', position: 'Hatchery Operator', address: 'Sagay, Camiguin', emergencyContactName: 'Ana Dela Cruz', emergencyContactPhone: '+63 917 555 0102' },
  { id: 'user-2', name: 'Maria Santos', email: 'maria@sagay-hatchery.ph', role: 'manager', site: mockTanks[0].site, active: true, lastActive: iso(3), employeeId: 'MG-2022-004', phone: '+63 917 555 0201', position: 'Hatchery Manager', address: 'Sagay, Camiguin', emergencyContactName: 'Luis Santos', emergencyContactPhone: '+63 917 555 0202' },
  { id: 'user-3', name: 'Dario Minoza', email: 'dario@sagay-hatchery.ph', role: 'admin', site: mockTanks[0].site, active: true, lastActive: iso(8), employeeId: 'AD-2021-001', phone: '+63 917 555 0301', position: 'System Administrator', address: 'Sagay, Camiguin', emergencyContactName: 'Lina Minoza', emergencyContactPhone: '+63 917 555 0302' },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'audit-1', timestamp: iso(1), user: 'Maria Santos', action: 'Alert acknowledged', detail: 'Dissolved oxygen · Larval Tank A' },
  { id: 'audit-2', timestamp: iso(6), user: 'Dario Minoza', action: 'Threshold updated', detail: 'Temperature maximum set to 32°C' },
  { id: 'audit-3', timestamp: iso(24), user: 'Juan Dela Cruz', action: 'Manual entry created', detail: 'Rain event · Larval Tank B' },
];
