interface RowProps {
  label: string;
  value: string;
  good?: boolean;
}

function Row({ label, value, good = true }: RowProps) {
  return (
    <div className="profile-row">
      <span>{label}</span>
      <b className={good ? 'is-good' : 'is-muted'}>{value}</b>
    </div>
  );
}

export default function DevicesCard() {
  return (
    <section className="dashboard-card profile-card" aria-label="Connected devices">
      <h2 className="profile-card-title">Connected Devices</h2>

      <h3 className="profile-section-title">Hardware Node</h3>
      <div className="profile-box">
        <p className="profile-group">ESP32-S3 Node - Tank A</p>
        <Row label="Status (3hr Sync Active):" value="Online" />
        <Row label="Wi-Fi RSSI: -65 dBm" value="Strong" />
      </div>

      <h3 className="profile-section-title">Power &amp; Backup System</h3>
      <div className="profile-box">
        <p className="profile-group">ESP32-S3 Node - Tank A</p>
        <Row label="LiFePO4 Battery:" value="92%" />
        <Row label="Solar Panel:" value="Charging" />
        <Row label="Main Power (Solar):" value="Active" />
      </div>

      <h3 className="profile-section-title">Active Sensors</h3>
      <div className="profile-box">
        <Row label="pH (Analog BNC)" value="Active" />
        <Row label="Temperature (DS18B20)" value="Active" />
        <Row label="DO (SEN0237-A)" value="Active" />
        <Row label="Salinity (BSK-EC-J100)" value="Active" />
      </div>
    </section>
  );
}
