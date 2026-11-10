import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useDeviceStatuses, useTanks } from '../../app/data/hooks';
import { useSelectedTank } from '../../app/tank/TankContext';

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
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState('');
  const { tankId } = useSelectedTank();
  const devices = useDeviceStatuses();
  const tanks = useTanks();
  const selectedTank = tanks.data?.find((tank) => tank.id === tankId);
  const tankDevice = devices.data?.find((device) => device.deviceId === selectedTank?.deviceId);
  const batteryDisplay = tankDevice?.batteryPct && tankDevice.batteryPct > 0 ? `${tankDevice.batteryPct}%` : 'Unavailable';

  const provisionDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const deviceId = String(data.get('deviceId') ?? '').trim();
    const ssid = String(data.get('ssid') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!deviceId || !ssid || !password) {
      setProvisionMessage('Enter the tank ID, Wi-Fi network, and Wi-Fi password.');
      return;
    }

    setIsProvisioning(true);
    setProvisionMessage('');

    try {
      const response = await fetch('http://192.168.4.1/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          device_id: deviceId,
          ssid,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setProvisionMessage('Configuration sent. The ESP32 will save it and restart.');
      event.currentTarget.reset();
    } catch (error) {
      setProvisionMessage(
        error instanceof TypeError && window.location.protocol === 'https:'
          ? 'HTTPS websites cannot submit to the ESP32 hotspot. Open this page on localhost/HTTP, or open the local setup page.'
          : 'Could not reach the ESP32. Connect this computer to the HydroSense-Setup Wi-Fi network and try again.',
      );
    } finally {
      setIsProvisioning(false);
    }
  };

  return (
    <section className="card settings-card settings-devices" aria-labelledby="connected-devices-title">
      <h2 className="settings-card-title" id="connected-devices-title">Connected Devices</h2>

      <div className="settings-device-section">
        <h3 className="settings-section-title">Provision ESP32</h3>
        <div className="settings-box">
          <p className="settings-muted">
            Connect this computer or phone to the ESP32 <strong>HydroSense-Setup-XXXX</strong> network,
            then enter the configuration below.
          </p>
          <form className="device-provision-form" onSubmit={provisionDevice}>
            <label>
              Tank ID
              <input name="deviceId" required maxLength={80} placeholder="HS-001" />
            </label>
            <label>
              Wi-Fi network
              <input name="ssid" required maxLength={32} placeholder="Wi-Fi name" />
            </label>
            <label>
              Wi-Fi password
              <input name="password" type="password" required maxLength={64} placeholder="Wi-Fi password" />
            </label>
            <button className="button button-primary provision-submit" type="submit" disabled={isProvisioning}>
              {isProvisioning ? 'Sending...' : 'Configure ESP32'}
            </button>
            {provisionMessage && <p className="settings-provision-message" role="status">{provisionMessage}</p>}
          </form>
          <a className="button device-provision-link" href="http://192.168.4.1" target="_blank" rel="noreferrer">
            Open ESP32 setup page
          </a>
        </div>
      </div>
      <div className="settings-device-grid">
        <div className="settings-device-section">
          <h3 className="settings-section-title">Hardware Node</h3>
          <div className="settings-box">
            <p className="session-group">ESP32-S3 Node - Tank A</p>
            <StatusRow label="Status (3hr Sync Active):" value="Online" />
            <StatusRow label="Wi-Fi RSSI: -65 dBm" value="Strong" />
          </div>
        </div>
        <div className="settings-device-section">
          <h3 className="settings-section-title">Power &amp; Backup System</h3>
          <div className="settings-box">
            <p className="session-group">ESP32-S3 Node - Tank A</p>
            <StatusRow label="LiFePO4 Battery:" value={batteryDisplay} />
            <StatusRow label="Solar Panel:" value="Unavailable" tone="bad" />
            <StatusRow label="Main Power (Solar):" value="Unavailable" tone="bad" />
          </div>
        </div>
        <div className="settings-device-section">
          <h3 className="settings-section-title">Active Sensors</h3>
          <div className="settings-box">
            <StatusRow label="pH (Analog BNC)" value="Active" />
            <StatusRow label="Temperature (DS18B20)" value="Active" />
            <StatusRow label="DO (SEN0237-A)" value="Active" />
            <StatusRow label="Salinity (BSK-EC-J100)" value="Active" />
          </div>
        </div>
      </div>
    </section>
  );
}
