export type OperatorLogKind = 'OPERATION' | 'ENVIRONMENT' | 'ALERT RESOLUTION';
export type OperatorAlertSeverity = 'WARNING' | 'CRITICAL';

export interface OperatorAlert {
  id: string;
  tankId: string;
  severity: OperatorAlertSeverity;
  title: string;
  description: string;
  detectedAt: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  resolutionNote?: string;
  resolvedAt?: string;
  verificationReading?: number;
  reading?: number;
  threshold?: number;
}

export interface OperatorLog {
  id: string;
  tankId: string;
  kind: OperatorLogKind;
  type: string;
  occurredAt: string;
  operator: string;
  notes: string;
  waterChangePercent?: number;
  impact?: string;
  manualReadings?: {
    dissolvedOxygen?: number;
    temperature?: number;
    ph?: number;
    salinity?: number;
    method?: string;
  };
}

export interface ThreeHourReading {
  timestamp: string;
  dissolvedOxygen: number;
  temperature: number;
  ph: number;
}

export const operatorName = 'Juan Dela Cruz';

export const operatorAlerts: OperatorAlert[] = [
  {
    id: 'operator-do-critical',
    tankId: 'tank-01',
    severity: 'CRITICAL',
    title: 'Dissolved Oxygen Below Configured Threshold',
    description:
      'A sensor reading is below the demo configured minimum. Verify it with a reference instrument and inspect aeration.',
    detectedAt: '09:12 AM',
    status: 'ACTIVE',
    reading: 0.3,
    threshold: 4,
  },
  {
    id: 'operator-water-level-warning',
    tankId: 'tank-01',
    severity: 'WARNING',
    title: 'Water Level Decline Reported',
    description:
      'A water-level decrease was reported during the morning tank inspection. Check for leakage or evaporation.',
    detectedAt: '08:45 AM',
    status: 'ACTIVE',
  },
];

const threeHourSamples: ThreeHourReading[] = [
  { timestamp: '21 hours ago', dissolvedOxygen: 7.0, temperature: 28.9, ph: 7.1 },
  { timestamp: '18 hours ago', dissolvedOxygen: 7.2, temperature: 29.0, ph: 7.2 },
  { timestamp: '15 hours ago', dissolvedOxygen: 7.1, temperature: 29.2, ph: 7.2 },
  { timestamp: '12 hours ago', dissolvedOxygen: 7.4, temperature: 29.4, ph: 7.3 },
  { timestamp: '9 hours ago', dissolvedOxygen: 7.3, temperature: 29.3, ph: 7.2 },
  { timestamp: '6 hours ago', dissolvedOxygen: 7.2, temperature: 29.5, ph: 7.2 },
  { timestamp: '3 hours ago', dissolvedOxygen: 7.1, temperature: 29.6, ph: 7.2 },
  { timestamp: 'Latest', dissolvedOxygen: 0.3, temperature: 29.7, ph: 7.2 },
];

export function getThreeHourReadings(tankId: string): ThreeHourReading[] {
  if (tankId === 'tank-01') return threeHourSamples;
  const tankOffset = tankId === 'tank-02' ? -0.3 : -0.6;
  return threeHourSamples.map((reading, index) => ({
    ...reading,
    dissolvedOxygen: index === threeHourSamples.length - 1
      ? 6.8 + tankOffset
      : Number(Math.max(0, reading.dissolvedOxygen + tankOffset).toFixed(1)),
    temperature: Number((reading.temperature + (tankId === 'tank-02' ? -0.5 : -0.8)).toFixed(1)),
    ph: Number((reading.ph + (tankId === 'tank-02' ? 0.2 : 0)).toFixed(1)),
  }));
}
