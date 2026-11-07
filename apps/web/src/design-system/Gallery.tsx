import { useEffect, useState } from 'react';
import {
  Activity, Bell, ClipboardList, Database, Droplets, Gauge, LayoutDashboard,
  Menu, Moon, Search, Settings, Shield, Sun, Users, Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  AdvisoryChip, BatteryIndicator, Button, ConnectionIndicator, DataTable, DateRangePicker,
  EmptyState, GlassCard, HeroReading, Input, ListRow, LoadingIndicator, Meter, Overlay,
  Pill, ProgressBar, SegmentedControl, Select, Skeleton, StatTile, StatusBadge, Tabs, Toast, Toggle,
} from './components';

type ThemeChoice = 'light' | 'dark' | 'system';
type Range = '24h' | '7d' | 'cycle';
const themeKey = 'hydrosense.gallery.theme';

function initialTheme(): ThemeChoice {
  try {
    const saved = localStorage.getItem(themeKey);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch (error) {
    console.warn('Gallery theme preference could not be loaded:', error);
    return 'system';
  }
}

function useGalleryTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(initialTheme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      document.documentElement.dataset.theme = choice === 'system' ? (media.matches ? 'dark' : 'light') : choice;
    };
    applyTheme();
    try { localStorage.setItem(themeKey, choice); }
    catch (error) { console.warn('Gallery theme preference could not be saved:', error); }
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [choice]);
  return { choice, setChoice };
}

const railItems: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Tanks', icon: Waves },
  { label: 'Trends', icon: Activity },
  { label: 'History', icon: Database },
  { label: 'Alerts', icon: Bell },
  { label: 'Settings', icon: Settings },
];

export default function Gallery() {
  const { choice, setChoice } = useGalleryTheme();
  const [range, setRange] = useState<Range>('24h');
  const [tab, setTab] = useState<'open' | 'acknowledged' | 'resolved'>('open');
  const [from, setFrom] = useState('2026-11-01');
  const [to, setTo] = useState('2026-11-07');
  const [enabled, setEnabled] = useState(true);
  const [dialog, setDialog] = useState<'modal' | 'sheet' | null>(null);
  const [toast, setToast] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  return <div className="ds-app">
    {railOpen && <button className="ds-rail-backdrop" type="button" aria-label="Close preview navigation" onClick={() => setRailOpen(false)} />}
    <aside className={`ds-rail ${railOpen ? 'ds-rail--open' : ''}`} aria-label="Example navigation">
      <a className="ds-logo" href="/" title="Return to dashboard" aria-label="Return to dashboard"><Waves size={22} strokeWidth={1.5} /></a>
      <nav aria-label="Preview only">{railItems.map(({ label, icon: Icon }, index) => <a key={label} href="#gallery" title={`${label} — preview only`} aria-label={`${label} — preview only`} aria-current={index === 0 ? 'page' : undefined}><Icon size={20} strokeWidth={1.5} /></a>)}</nav>
      <span className="ds-rail-footer" title="Preview account"><Shield size={20} strokeWidth={1.5} aria-label="Preview account" /></span>
    </aside>
    <div className="ds-main" id="gallery">
      <header className="ds-topbar">
        <div className="ds-top-title"><button className="ds-icon-button ds-mobile-menu" type="button" aria-label="Open preview navigation" onClick={() => setRailOpen(true)}><Menu size={20} /></button><div><span className="ds-eyebrow">HYDROSENSE · DESIGN SYSTEM</span><h1>Component gallery</h1></div></div>
        <div className="ds-top-actions">
          <label className="ds-search"><Search size={17} aria-hidden="true" /><input disabled aria-label="Search preview (not available)" placeholder="Search preview" /><kbd>⌘ K</kbd></label>
          <span className="ds-icon-button ds-bell" aria-label="Preview: 1 open alert"><Bell size={20} strokeWidth={1.5} aria-hidden="true" /><span>1</span></span>
          <label className="ds-theme"><Sun size={17} aria-hidden="true" /><span className="ds-sr-only">Gallery theme</span><select value={choice} onChange={(event) => setChoice(event.target.value as ThemeChoice)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select><Moon size={17} aria-hidden="true" /></label>
          <details className="ds-user-menu"><summary aria-label="Preview account menu"><span className="ds-avatar">JD</span><span>Juan Dela Cruz</span></summary><div><a href="/">Return to dashboard</a><p>Preview account · Operator</p></div></details>
        </div>
      </header>
      <main className="ds-content">
        <div className="ds-intro"><div><p className="ds-eyebrow">A CALMER WAY TO MONITOR</p><h2>Good morning, Juan.</h2><p>Review the visual system in light, dark or system theme before it is applied to dashboard screens.</p></div><div className="ds-inline"><Pill>Operator</Pill><Pill>Pilot</Pill></div></div>
        <div className="ds-safety-banner" role="note"><Bell size={18} aria-hidden="true" /><span><strong>Critical alert example</strong> · A persistent alert remains visible until acknowledged.</span><span>Preview only</span></div>

        <div className="ds-section-heading"><div><p className="ds-eyebrow">01 · READINGS</p><h2>Hero readings</h2></div><span>Measured parameters only</span></div>
        <div className="ds-grid ds-grid-3">
          <HeroReading label="Temperature" value="29.7" unit="°C" level="normal" detail="Safe 28–32 °C · updated 11:00 PHT" />
          <HeroReading label="Dissolved oxygen" value="4.3" unit="mg/L" level="warning" detail="Safe ≥4 mg/L · updated 11:00 PHT" />
          <HeroReading label="pH" value="5.6" unit="pH" level="critical" detail="Safe 6–8 pH · updated 11:00 PHT" />
        </div>

        <div className="ds-grid ds-grid-2">
          <GlassCard title="Status and advisory labels" action={<Pill>Text + icon</Pill>}>
            <p className="ds-helper">Status is never communicated by color alone.</p>
            <div className="ds-wrap"><StatusBadge level="normal" /><StatusBadge level="warning" /><StatusBadge level="critical" /></div>
            <div className="ds-wrap ds-advisories">
              <AdvisoryChip kind="Salinity" level="low" explanation="Inputs: temperature 29.7 °C; no rain or freshwater event. Rule: below the watch threshold. Reference salinity target: 28–33 ppt." />
              <AdvisoryChip kind="Salinity" level="watch" explanation="Inputs: temperature 31 °C; no rain or freshwater event. Rule: temperature reached the watch threshold." />
              <AdvisoryChip kind="Ammonia" level="high" explanation="Inputs: pH 7.9 and high feeding load. Rule: high pH with high feeding load." />
            </div>
          </GlassCard>
          <GlassCard title="Meters and progress" action={<Gauge size={19} aria-hidden="true" />}>
            <Meter label="Sample reading position" value={57} />
            <ProgressBar label="Offline records syncing" value={68} />
            <div className="ds-wrap"><BatteryIndicator value={86} /><ConnectionIndicator online /><ConnectionIndicator online={false} /><LoadingIndicator /></div>
          </GlassCard>
        </div>

        <div className="ds-section-heading"><div><p className="ds-eyebrow">02 · CONTROLS</p><h2>Interaction patterns</h2></div><span>44 px minimum targets</span></div>
        <div className="ds-grid ds-grid-2">
          <GlassCard title="Buttons, tabs and controls">
            <div className="ds-wrap"><Button variant="primary">Primary action</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button disabled>Disabled</Button></div>
            <div className="ds-stack">
              <Tabs label="Alert status" value={tab} onChange={setTab} options={[{ value: 'open', label: 'Open', content: 'Open alert examples.' }, { value: 'acknowledged', label: 'Acknowledged', content: 'Acknowledged alert examples.' }, { value: 'resolved', label: 'Resolved', content: 'Resolved alert examples.' }]} />
              <SegmentedControl label="Trend range" value={range} onChange={setRange} options={[{ value: '24h', label: '24 hours' }, { value: '7d', label: '7 days' }, { value: 'cycle', label: 'Full cycle' }]} />
              <Toggle label="Example notification preference" checked={enabled} onChange={setEnabled} />
              <Toggle label="Unavailable preference" checked={false} onChange={() => {}} disabled />
            </div>
          </GlassCard>
          <GlassCard title="Inputs and selection">
            <div className="ds-form-grid"><Input label="Tank name" defaultValue="Larval Tank A" /><Select label="Measured parameter" defaultValue="do"><option value="do">Dissolved oxygen</option><option value="temperature">Temperature</option><option value="ph">pH</option></Select></div>
            <div className="ds-stack"><DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} /><Input label="Disabled input" disabled placeholder="Unavailable" /><p className="ds-field-error" role="note">Example validation: Enter a valid value.</p></div>
          </GlassCard>
        </div>

        <div className="ds-section-heading"><div><p className="ds-eyebrow">03 · DATA & FEEDBACK</p><h2>Content patterns</h2></div><span>Example data only</span></div>
        <div className="ds-grid ds-grid-3">
          <GlassCard title="Statistics"><div className="ds-stat-grid"><StatTile label="Rearing day" value="11 / 21" detail="Larval Tank A" /><StatTile label="Open alerts" value="1" detail="Requires review" /></div><div className="ds-wrap"><Pill>Manager</Pill><Pill>Admin</Pill><Pill>Premium</Pill></div></GlassCard>
          <GlassCard title="Settings rows"><ListRow icon={Users} label="Team members" value="3 people" /><ListRow icon={Droplets} label="Tank assignment" value="Tank A" /><ListRow icon={ClipboardList} label="Activity log" value="Review" /></GlassCard>
          <GlassCard title="Loading and empty"><Skeleton /><EmptyState>No records found for this example.</EmptyState></GlassCard>
        </div>
        <GlassCard title="Data table" action={<Pill>Sticky header</Pill>}>
          <DataTable headers={['Time (PHT)', 'Parameter', 'Value', 'Status']} rows={[
            ['11:00', 'Temperature', '29.7 °C', <StatusBadge level="normal" />],
            ['08:00', 'Dissolved oxygen', '4.3 mg/L', <StatusBadge level="warning" />],
            ['05:00', 'pH', '5.6 pH', <StatusBadge level="critical" />],
          ]} />
        </GlassCard>
        <GlassCard title="Overlays and notifications" action={<Button variant="ghost" aria-label="Example card action menu" onClick={() => setToast(true)}>Card action</Button>}>
          <div className="ds-wrap"><Button onClick={() => setDialog('modal')}>Open modal</Button><Button onClick={() => setDialog('sheet')}>Open side sheet</Button><Button onClick={() => setToast(true)}>Show toast</Button></div>
          <p className="ds-helper">Dialogs and notifications below are interactive previews; no settings or records are changed.</p>
        </GlassCard>
        <footer className="ds-footer">Design review only · No live readings or hardware controls</footer>
      </main>
    </div>
    <Overlay open={dialog === 'modal'} onClose={() => setDialog(null)} title="Confirm example change"><p>This demonstrates a confirmation dialog. No records will be changed.</p><div className="ds-wrap"><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" onClick={() => { setDialog(null); setToast(true); }}>Confirm example</Button></div></Overlay>
    <Overlay open={dialog === 'sheet'} onClose={() => setDialog(null)} title="Example side sheet" side><p>Additional details can appear here without leaving the current view.</p><Button onClick={() => setDialog(null)}>Close</Button></Overlay>
    {toast && <Toast onClose={() => setToast(false)}>Example action completed.</Toast>}
  </div>;
}
