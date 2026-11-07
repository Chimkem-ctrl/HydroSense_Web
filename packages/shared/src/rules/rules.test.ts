import { describe, expect, it } from 'vitest';
import { getAmmoniaAdvisory, getSalinityAdvisory } from './advisory';
import { getParameterStatus } from './status';
import { canAccessRole, validateAcknowledgeNote, validateAdvisoryRules, validateManualEntry, validateValidationTolerances } from '../validation';
import { MockApiClient } from '../api/mockClient';
import { getManilaDateString, getRaisingDay } from '../format';

describe('measured status display', () => {
  it('keeps values within the safe range normal and identifies near-limit readings', () => {
    expect(getParameterStatus('temperature', 30).level).toBe('normal');
    expect(getParameterStatus('temperature', 32.2).level).toBe('warning');
    expect(getParameterStatus('do', 3).level).toBe('critical');
  });
});

describe('advisory rules', () => {
  it('reports the fired salinity rule and evidence without treating it as a sensor reading', () => {
    const advisory = getSalinityAdvisory({ temperatureC: 32, rainEvent: false, freshwaterDosing: false });
    expect(advisory).toMatchObject({ kind: 'salinity', level: 'high' });
    expect(advisory.inputs).toMatchObject({ temperatureC: 32, recentRainEvent: 'no' });
    expect(advisory.firedRule).toContain('without a recent dilution event');
  });

  it('raises ammonia to watch when feeding load is high without a high pH', () => {
    expect(getAmmoniaAdvisory({ temperatureC: 29, ph: 7.2, feedingLoad: 'high' }).level).toBe('watch');
  });
});

describe('form validation and role access', () => {
  it('requires a valid tank entry and a response note', () => {
    expect(validateManualEntry({ type: 'refractometer_salinity', tankId: 'tank-a', enteredBy: 'Operator', value: -1 })).toHaveLength(1);
    expect(validateAcknowledgeNote('  ')).toHaveLength(1);
    expect(validateAcknowledgeNote('Checked the meter')).toHaveLength(0);
  });

  it('only grants routes to an explicitly allowed role', () => {
    expect(canAccessRole('operator', ['operator', 'admin'])).toBe(true);
    expect(canAccessRole('operator', ['admin'])).toBe(false);
    expect(canAccessRole(null, ['admin'])).toBe(false);
  });

  it('rejects invalid advisory rules and negative validation tolerances', () => {
    expect(validateAdvisoryRules({
      salinityWatchTemperatureC: 32,
      salinityHighTemperatureC: 31,
      ammoniaWatchTemperatureC: 31,
      ammoniaHighPh: 8,
    })).toHaveLength(1);
    expect(validateValidationTolerances({ temperature: 0.5, ph: 0.2, do: -1 })).toHaveLength(1);
  });
});

describe('mock tank administration', () => {
  it('registers a hardware-linked tank and prevents deleting the last tank', async () => {
    const api = new MockApiClient();
    const tank = await api.createTank({
      name: 'Larval Tank C',
      site: 'Sagay Hatchery',
      rearingStartDate: '2025-01-01',
      deviceId: 'HS-MF-003',
    }, 'Admin');
    expect((await api.listTanks()).some((item) => item.id === tank.id)).toBe(true);
    expect((await api.listDeviceStatuses()).some((item) => item.deviceId === tank.deviceId && item.online)).toBe(true);
    expect(await api.getLatestReading(tank.id)).toMatchObject({ tankId: tank.id, temperature: 30 });
    expect(await api.listAdvisories(tank.id)).toHaveLength(2);
    await api.deleteTank(tank.id, 'Admin');
    expect((await api.listTanks()).some((item) => item.id === tank.id)).toBe(false);
    await api.deleteTank('tank-b', 'Admin');
    await expect(api.deleteTank('tank-a', 'Admin')).rejects.toThrow('At least one tank must remain registered.');
  });

  it('updates rule-based advisories when manual water events or rules change', async () => {
    const api = new MockApiClient();
    expect((await api.listAdvisories('tank-a')).find((item) => item.kind === 'salinity')?.level).toBe('low');
    await api.createManualEntry({ tankId: 'tank-a', type: 'rain_event', enteredBy: 'Operator' });
    expect((await api.listAdvisories('tank-a')).find((item) => item.kind === 'salinity')?.level).toBe('watch');
    await api.updateAdvisorySettings({
      salinityWatchTemperatureC: 29,
      salinityHighTemperatureC: 31,
      ammoniaWatchTemperatureC: 31,
      ammoniaHighPh: 7.8,
    }, 'Manager');
    expect((await api.listAdvisories('tank-a')).find((item) => item.kind === 'salinity')?.firedRule).toContain('recent water event');
  });
});

describe('Asia/Manila date helpers', () => {
  it('uses the Manila calendar day near UTC midnight', () => {
    const at = new Date('2025-02-01T16:30:00.000Z');
    expect(getManilaDateString(at)).toBe('2025-02-02');
    expect(getRaisingDay('2025-02-02', at)).toBe(0);
  });

  it('filters mock readings by timestamp instants across UTC and Manila offsets', async () => {
    const api = new MockApiClient();
    const from = `${getManilaDateString()}T00:00:00+08:00`;
    const readings = await api.listReadings({ tankId: 'tank-a', from });
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.every((reading) => Date.parse(reading.timestamp) >= Date.parse(from))).toBe(true);
    expect(readings.some((reading) => reading.timestamp.slice(0, 10) !== from.slice(0, 10))).toBe(true);
  });
});
