import type { AdvisoryRuleSettings, AlertItem, CalibrationLog, DashboardUser, ManualEntry, Tank, Threshold, ValidationTolerance } from '../types';
import { DEFAULT_ADVISORY_RULES, getAmmoniaAdvisory, getSalinityAdvisory } from '../rules/advisory';
import { DEFAULT_VALIDATION_TOLERANCES } from '../validation';
import {
  mockAdvisoryStates,
  mockAlertResponses,
  mockAlerts,
  mockAuditLogs,
  mockCalibrationLogs,
  mockDevices,
  mockManualEntries,
  mockReadings,
  mockTanks,
  mockThresholds,
  mockUsers,
  mockValidationRows,
} from '../mock/data';
import type { AcknowledgeAlertInput, CreateCalibrationInput, HydroSenseApi, ReadingQuery } from './types';

const clone = <T>(value: T): T => structuredClone(value);

export class MockApiClient implements HydroSenseApi {
  private tanks = clone(mockTanks);
  private devices = clone(mockDevices);
  private readings = clone(mockReadings);
  private advisories = clone(mockAdvisoryStates);
  private alerts = clone(mockAlerts);
  private responses = clone(mockAlertResponses);
  private entries = clone(mockManualEntries);
  private calibrations = clone(mockCalibrationLogs);
  private thresholds = clone(mockThresholds);
  private advisorySettings = clone(DEFAULT_ADVISORY_RULES);
  private tolerances = clone(DEFAULT_VALIDATION_TOLERANCES);
  private users = clone(mockUsers);
  private auditLogs = clone(mockAuditLogs);
  private auditSequence = 0;

  async listTanks() { return clone(this.tanks); }
  async createTank(input: Omit<Tank, 'id'>, changedBy: string) {
    if (!input.name.trim() || !input.site.trim() || !input.deviceId.trim() || Number.isNaN(Date.parse(`${input.rearingStartDate}T00:00:00+08:00`))) {
      throw new Error('Tank name, site, rearing date and hardware ID are required.');
    }
    if (this.tanks.some((tank) => tank.deviceId.toLowerCase() === input.deviceId.trim().toLowerCase())) {
      throw new Error(`Hardware ID ${input.deviceId} is already assigned to a tank.`);
    }
    const tank = { ...input, name: input.name.trim(), site: input.site.trim(), deviceId: input.deviceId.trim(), id: `tank-${Date.now()}-${this.tanks.length}` };
    this.tanks.push(tank);
    this.devices.push({
      deviceId: tank.deviceId,
      online: true,
      lastSeen: new Date().toISOString(),
      batteryPct: 100,
      powerSource: 'grid',
      wifiRssi: -60,
      pendingSyncCount: 0,
    });
    const timestamp = new Date().toISOString();
    this.readings.push({
      id: `${tank.id}-initial`,
      tankId: tank.id,
      timestamp,
      temperature: 30,
      doMgL: 6,
      ph: 7.2,
    });
    this.advisories[tank.id] = [
      getSalinityAdvisory({ temperatureC: 30, rainEvent: false, freshwaterDosing: false }, this.advisorySettings, timestamp),
      getAmmoniaAdvisory({ temperatureC: 30, ph: 7.2, feedingLoad: 'usual' }, this.advisorySettings, timestamp),
    ];
    this.recordAudit(changedBy, 'Tank registered', `${tank.name} · hardware ${tank.deviceId}`);
    return clone(tank);
  }
  async deleteTank(tankId: string, changedBy: string) {
    if (this.tanks.length <= 1) throw new Error('At least one tank must remain registered.');
    const index = this.tanks.findIndex((tank) => tank.id === tankId);
    if (index < 0) throw new Error(`Tank ${tankId} was not found.`);
    const [tank] = this.tanks.splice(index, 1);
    this.devices = this.devices.filter((device) => device.deviceId !== tank.deviceId);
    this.readings = this.readings.filter((reading) => reading.tankId !== tankId);
    this.alerts = this.alerts.filter((alert) => alert.tankId !== tankId);
    const alertIds = new Set(this.alerts.map((alert) => alert.id));
    this.responses = this.responses.filter((response) => alertIds.has(response.alertId));
    this.entries = this.entries.filter((entry) => entry.tankId !== tankId);
    this.calibrations = this.calibrations.filter((log) => log.tankId !== tankId);
    delete this.advisories[tankId];
    this.recordAudit(changedBy, 'Tank removed', `${tank.name} · hardware ${tank.deviceId}`);
  }

  async listReadings(query: ReadingQuery = {}) {
    const from = query.from === undefined ? undefined : Date.parse(query.from);
    const to = query.to === undefined ? undefined : Date.parse(query.to);
    let rows = this.readings.filter((row) =>
      (!query.tankId || row.tankId === query.tankId) &&
      (from === undefined || Date.parse(row.timestamp) >= from) &&
      (to === undefined || Date.parse(row.timestamp) <= to));
    if (query.parameter && query.parameter !== 'all') {
      rows = rows.map((row) => ({
        ...row,
        ...(query.parameter !== 'temperature' && { temperature: Number.NaN }),
        ...(query.parameter !== 'do' && { doMgL: Number.NaN }),
        ...(query.parameter !== 'ph' && { ph: Number.NaN }),
      }));
    }
    return clone(query.limit ? rows.slice(-query.limit) : rows);
  }

  async getLatestReading(tankId: string) {
    const rows = this.readings.filter((row) => row.tankId === tankId);
    return clone(rows[rows.length - 1] ?? null);
  }

  async listDeviceStatuses() { return clone(this.devices); }
  async listAlerts(tankId?: string) { return clone(this.alerts.filter((alert) => !tankId || alert.tankId === tankId)); }
  async listAlertResponses(alertId: string) { return clone(this.responses.filter((response) => response.alertId === alertId)); }

  private setAlertStatus(alertId: string, status: AlertItem['status'], input: AcknowledgeAlertInput) {
    const index = this.alerts.findIndex((alert) => alert.id === alertId);
    if (index < 0) throw new Error(`Alert ${alertId} was not found.`);
    const current = this.alerts[index];
    const timestamp = new Date().toISOString();
    const updated: AlertItem = {
      ...current,
      status,
      ...(status !== 'open' && { acknowledgedBy: input.user, acknowledgedAt: timestamp, note: input.note }),
    };
    this.alerts[index] = updated;
    this.responses.push({
      id: `response-${Date.now()}`,
      alertId,
      status,
      note: input.note,
      createdAt: timestamp,
      createdBy: input.user,
    });
    this.recordAudit(input.user, `Alert ${status}`, `${current.parameter} · ${current.tankId}`);
    return clone(updated);
  }

  async acknowledgeAlert(alertId: string, input: AcknowledgeAlertInput) {
    return this.setAlertStatus(alertId, 'acknowledged', input);
  }
  async resolveAlert(alertId: string, input: AcknowledgeAlertInput) {
    return this.setAlertStatus(alertId, 'resolved', input);
  }

  async listManualEntries(tankId?: string) { return clone(this.entries.filter((entry) => !tankId || entry.tankId === tankId)); }
  async createManualEntry(entry: Omit<ManualEntry, 'id' | 'timestamp'>) {
    const created = { ...entry, id: `entry-${Date.now()}`, timestamp: new Date().toISOString() };
    this.entries.unshift(created);
    this.refreshAdvisories(created.tankId, created.timestamp);
    this.recordAudit(created.enteredBy, 'Manual entry created', `${created.type} · ${created.tankId}`);
    return clone(created);
  }
  async listThresholds() { return clone(this.thresholds); }
  async updateThresholds(thresholds: Threshold[], changedBy: string) {
    this.thresholds = clone(thresholds);
    this.recordAudit(changedBy, 'Thresholds updated', 'Measured parameter limits changed');
    return clone(this.thresholds);
  }
  async getAdvisorySettings() { return clone(this.advisorySettings); }
  async updateAdvisorySettings(settings: AdvisoryRuleSettings, changedBy: string) {
    this.advisorySettings = clone(settings);
    for (const tank of this.tanks) this.refreshAdvisories(tank.id);
    this.recordAudit(changedBy, 'Advisory rules updated', 'Salinity and ammonia rules changed');
    return clone(this.advisorySettings);
  }
  async listAdvisories(tankId: string) { return clone(this.advisories[tankId] ?? []); }
  async listCalibrationLogs(tankId?: string) { return clone(this.calibrations.filter((log) => !tankId || log.tankId === tankId)); }
  async createCalibrationLog(log: CreateCalibrationInput) {
    const created: CalibrationLog = { ...log, id: `cal-${Date.now()}` };
    this.calibrations.unshift(created);
    this.recordAudit(created.user, 'Calibration recorded', `${created.parameter.toUpperCase()} · ${created.tankId}`);
    return clone(created);
  }
  async listValidationRows() { return clone(mockValidationRows); }
  async getValidationTolerances() { return clone(this.tolerances); }
  async updateValidationTolerances(tolerances: ValidationTolerance, changedBy: string) {
    this.tolerances = clone(tolerances);
    this.recordAudit(changedBy, 'Validation tolerances updated', 'Sensor-reference comparison limits changed');
    return clone(this.tolerances);
  }
  async listUsers() { return clone(this.users); }
  async updateUserRole(userId: string, role: DashboardUser['role'], changedBy: string) {
    const index = this.users.findIndex((user) => user.id === userId);
    if (index < 0) throw new Error(`User ${userId} was not found.`);
    this.users[index] = { ...this.users[index], role };
    this.recordAudit(changedBy, 'User role updated', `${userId} role set to ${role}`);
    return clone(this.users[index]);
  }
  async listAuditLogs() { return clone(this.auditLogs); }

  private refreshAdvisories(tankId: string, updatedAt = new Date().toISOString()) {
    const readings = this.readings.filter((reading) => reading.tankId === tankId);
    const latest = readings[readings.length - 1];
    if (!latest) return;
    const entries = this.entries.filter((entry) => entry.tankId === tankId);
    const previousAmmonia = this.advisories[tankId]?.find((item) => item.kind === 'ammonia');
    this.advisories[tankId] = [
      getSalinityAdvisory({
        temperatureC: latest.temperature,
        rainEvent: entries.some((entry) => entry.type === 'rain_event'),
        freshwaterDosing: entries.some((entry) => entry.type === 'freshwater_dosing'),
      }, this.advisorySettings, updatedAt),
      getAmmoniaAdvisory({
        temperatureC: latest.temperature,
        ph: latest.ph,
        feedingLoad: previousAmmonia?.inputs.feedingLoad === 'high' ? 'high' : 'usual',
      }, this.advisorySettings, updatedAt),
    ];
  }

  private recordAudit(user: string, action: string, detail: string) {
    this.auditSequence += 1;
    this.auditLogs.unshift({
      id: `audit-${Date.now()}-${this.auditSequence}`,
      timestamp: new Date().toISOString(),
      user,
      action,
      detail,
    });
  }
}
