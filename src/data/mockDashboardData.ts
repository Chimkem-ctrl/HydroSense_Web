export interface Tank {
  id: string;
  name: string;
  type: string;
  dissolvedOxygen: number;
  temperature: number;
  ph: number;
  sensors: number;
  lastReading: string;
}

export interface DashboardAlert {
  id: string;
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  tankId: string;
  tankName: string;
  timestamp: string;
  source: string;
  description: string;
  recommendedAction: string;
  sensorReading?: string;
  threshold?: number;
  operator?: string;
  acknowledged: boolean;
}

export interface OperatorActivity {
  time: string;
  operator: string;
  activity: string;
  tank: string;
  details: string;
}

export const tanks: Tank[] = [
  {
    id: 'tank-01',
    name: 'Tank 01',
    type: 'Larval Rearing Tank',
    dissolvedOxygen: 7.3,
    temperature: 29.7,
    ph: 7.2,
    sensors: 3,
    lastReading: '09:32 AM',
  },
  {
    id: 'tank-02',
    name: 'Tank 02',
    type: 'Larval Rearing Tank',
    dissolvedOxygen: 6.8,
    temperature: 29.2,
    ph: 7.4,
    sensors: 3,
    lastReading: '09:30 AM',
  },
  {
    id: 'tank-03',
    name: 'Tank 03',
    type: 'Nursery Tank',
    dissolvedOxygen: 6.5,
    temperature: 28.9,
    ph: 7.1,
    sensors: 3,
    lastReading: '09:28 AM',
  },
];

export const dashboardAlerts: DashboardAlert[] = [
  {
    id: 'operator-water-level',
    severity: 'WARNING',
    title: 'Unusual Water Level Decline Reported',
    tankId: 'tank-01',
    tankName: 'Tank 01 – Larval Rearing Tank',
    timestamp: 'November 7, 2026 | 08:45 AM',
    source: 'Operator Activity Log',
    description:
      'An operator reported an unusual decrease in water level during the morning tank inspection.',
    recommendedAction:
      "Inspect the tank for possible leakage or unusual evaporation. Verify the water level and check whether water replacement is necessary.",
    operator: 'Juan Dela Cruz',
    acknowledged: false,
  },
  {
    id: 'low-dissolved-oxygen',
    severity: 'CRITICAL',
    title: 'Dissolved Oxygen Below Configured Threshold',
    tankId: 'tank-01',
    tankName: 'Tank 01 – Larval Rearing Tank',
    timestamp: 'November 7, 2026 | 09:12 AM',
    source: 'Sensor Monitoring System',
    description:
      'The dissolved oxygen reading has fallen below the configured minimum threshold. Immediate verification is recommended.',
    recommendedAction:
      "Verify the reading using an appropriate reference instrument and inspect the aeration system. Follow the hatchery's established emergency response procedure.",
    sensorReading: '0.3 mg/L',
    threshold: 4,
    acknowledged: false,
  },
];

export const operatorActivities: OperatorActivity[] = [
  {
    time: '08:45 AM',
    operator: 'Juan Dela Cruz',
    activity: 'Tank Inspection',
    tank: 'Tank 01',
    details: 'Unusual water-level decline',
  },
  {
    time: '08:30 AM',
    operator: 'Maria Santos',
    activity: 'Water Observation',
    tank: 'Tank 01',
    details: 'No unusual larval behavior',
  },
  {
    time: '07:15 AM',
    operator: 'Juan Dela Cruz',
    activity: 'Equipment Inspection',
    tank: 'Tank 01',
    details: 'Aeration equipment checked',
  },
  {
    time: '06:50 AM',
    operator: 'Maria Santos',
    activity: 'Water Replacement',
    tank: 'Tank 02',
    details: 'Partial water replacement recorded',
  },
  {
    time: 'Yesterday',
    operator: 'Ramon Garcia',
    activity: 'Sensor Check',
    tank: 'Tank 03',
    details: 'pH probe rinsed and inspected',
  },
  {
    time: 'Yesterday',
    operator: 'Maria Santos',
    activity: 'Tank Inspection',
    tank: 'Tank 02',
    details: 'Routine visual inspection completed',
  },
];

export const deviceSensors = [
  { sensor: 'Dissolved Oxygen', unit: 'HS-001', status: 'ONLINE' },
  { sensor: 'Temperature', unit: 'HS-001', status: 'ONLINE' },
  { sensor: 'pH', unit: 'HS-001', status: 'ONLINE' },
] as const;

export const trendSeries = {
  dissolvedOxygen: {
    label: 'Dissolved Oxygen',
    unit: 'mg/L',
    color: '#49d6b1',
    values: [6.8, 7.1, 7.0, 7.4, 7.2, 7.3, 7.5, 7.3, 7.4, 7.3],
  },
  temperature: {
    label: 'Temperature',
    unit: '°C',
    color: '#f5b75e',
    values: [28.8, 29.1, 29.5, 29.2, 29.6, 29.4, 29.8, 29.5, 29.7, 29.7],
  },
  ph: {
    label: 'pH',
    unit: 'pH',
    color: '#7fa8ff',
    values: [7.0, 7.1, 7.0, 7.2, 7.3, 7.1, 7.2, 7.2, 7.1, 7.2],
  },
} as const;
