import type { AdvisoryRuleSettings, AlertItem, CalibrationLog, DashboardUser, ManualEntry, Reading, Tank, Threshold, ValidationRow, ValidationTolerance } from '../types';
import type { AcknowledgeAlertInput, HydroSenseApi, ReadingQuery } from './types';

export class HttpApiClient implements HydroSenseApi {
  constructor(private readonly baseUrl: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HydroSense API ${response.status} ${response.statusText}: ${body || path}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  listTanks() { return this.request<Tank[]>('/api/v1/tanks'); }
  createTank(tank: Omit<Tank, 'id'>, changedBy: string) {
    return this.request<Tank>('/api/v1/tanks', { method: 'POST', body: JSON.stringify({ ...tank, changedBy }) });
  }
  deleteTank(tankId: string, changedBy: string) {
    const params = new URLSearchParams({ changed_by: changedBy });
    return this.request<void>(`/api/v1/tanks/${encodeURIComponent(tankId)}?${params}`, { method: 'DELETE' });
  }
  listReadings(query: ReadingQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return this.request<Reading[]>(`/api/v1/readings${params.size ? `?${params}` : ''}`);
  }
  getLatestReading(tankId: string) { return this.request<Reading | null>(`/api/v1/tanks/${encodeURIComponent(tankId)}/readings/latest`); }
  listDeviceStatuses() { return this.request<import('../types').DeviceStatus[]>('/api/v1/devices/status'); }
  listAlerts(tankId?: string) { return this.request<AlertItem[]>(`/api/v1/alerts${tankId ? `?tank_id=${encodeURIComponent(tankId)}` : ''}`); }
  listAlertResponses(alertId: string) { return this.request<import('../types').AlertResponse[]>(`/api/v1/alerts/${encodeURIComponent(alertId)}/responses`); }
  acknowledgeAlert(alertId: string, input: AcknowledgeAlertInput) {
    return this.request<AlertItem>(`/api/v1/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST', body: JSON.stringify(input) });
  }
  resolveAlert(alertId: string, input: AcknowledgeAlertInput) {
    return this.request<AlertItem>(`/api/v1/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST', body: JSON.stringify(input) });
  }
  listManualEntries(tankId?: string) { return this.request<ManualEntry[]>(`/api/v1/manual-entries${tankId ? `?tank_id=${encodeURIComponent(tankId)}` : ''}`); }
  createManualEntry(entry: Omit<ManualEntry, 'id' | 'timestamp'>) {
    return this.request<ManualEntry>('/api/v1/manual-entries', { method: 'POST', body: JSON.stringify(entry) });
  }
  listThresholds() { return this.request<Threshold[]>('/api/v1/settings/thresholds'); }
  updateThresholds(thresholds: Threshold[], changedBy: string) {
    return this.request<Threshold[]>('/api/v1/settings/thresholds', { method: 'PUT', body: JSON.stringify({ thresholds, changedBy }) });
  }
  getAdvisorySettings() { return this.request<AdvisoryRuleSettings>('/api/v1/settings/advisory-rules'); }
  updateAdvisorySettings(settings: AdvisoryRuleSettings, changedBy: string) {
    return this.request<AdvisoryRuleSettings>('/api/v1/settings/advisory-rules', { method: 'PUT', body: JSON.stringify({ settings, changedBy }) });
  }
  listAdvisories(tankId: string) { return this.request<import('../types').AdvisoryState[]>(`/api/v1/tanks/${encodeURIComponent(tankId)}/advisories`); }
  listCalibrationLogs(tankId?: string) { return this.request<CalibrationLog[]>(`/api/v1/calibrations${tankId ? `?tank_id=${encodeURIComponent(tankId)}` : ''}`); }
  createCalibrationLog(log: Omit<CalibrationLog, 'id'>) {
    return this.request<CalibrationLog>('/api/v1/calibrations', { method: 'POST', body: JSON.stringify(log) });
  }
  listValidationRows(tankId?: string) { return this.request<ValidationRow[]>(`/api/v1/validation${tankId ? `?tank_id=${encodeURIComponent(tankId)}` : ''}`); }
  getValidationTolerances() { return this.request<ValidationTolerance>('/api/v1/validation/tolerances'); }
  updateValidationTolerances(tolerances: ValidationTolerance, changedBy: string) {
    return this.request<ValidationTolerance>('/api/v1/validation/tolerances', { method: 'PUT', body: JSON.stringify({ tolerances, changedBy }) });
  }
  listUsers() { return this.request<DashboardUser[]>('/api/v1/admin/users'); }
  updateUserRole(userId: string, role: DashboardUser['role'], changedBy: string) {
    return this.request<DashboardUser>(`/api/v1/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PUT', body: JSON.stringify({ role, changedBy }) });
  }
  listAuditLogs() { return this.request<import('../types').AuditLog[]>('/api/v1/admin/logs'); }
}
