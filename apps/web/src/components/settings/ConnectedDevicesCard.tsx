import type { ReactNode } from 'react';
import GlassPanel from '../common/GlassPanel';

interface StatusRowProps {
  label: ReactNode;
  value: string;
  tone?: 'good' | 'bad';
}

function StatusRow({ label, value, tone = 'good' }: StatusRowProps) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <span className={tone === 'good' ? 'status-good' : 'status-bad'}>
        {value}
      </span>
    </div>
  );
}

export default function ConnectedDevicesCard() {
  return (
    <GlassPanel className="settings-card">
      <h2 className="settings-card-title">Connected Devices</h2>

      <h3 className="settings-section-title">Hardware Node</h3>
      <div className="settings-box">
        <p className="session-group">ESP32-S3 Node - Tank A</p>
        <StatusRow label="Status (3hr Sync Active):" value="Online" />
        <StatusRow label="Wi-Fi RSSI: -65 dBm" value="Strong" />
      </div>

      <h3 className="settings-section-title">Power &amp; Backup System</h3>
      <div className="settings-box">
        <p className="session-group">ESP32-S3 Node - Tank A</p>
        <StatusRow label="LiFePO4 Battery:" value="92%" />
        <StatusRow label="Solar Panel:" value="Charging" />
        <StatusRow label="Main Power (Solar):" value="Active" />
      </div>

      <h3 className="settings-section-title">Active Sensors</h3>
      <div className="settings-box">
        <StatusRow label="pH (Analog BNC)" value="Active" />
        <StatusRow label="Temperature (DS18B20)" value="Active" />
        <StatusRow label="DO (SEN0237-A)" value="Active" />
        <StatusRow label="Salinity (BSK-EC-J100)" value="Active" />
      </div>
    </GlassPanel>
  );
}
