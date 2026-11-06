import { ArrowLeft, Clock3, Keyboard, KeyRound, Settings, User } from 'lucide-react';
import type { AuditEntry, AuditIcon } from './profileData';

const icons: Record<AuditIcon, typeof Settings> = {
  config: Settings,
  user: User,
  key: KeyRound,
  session: Keyboard,
  profile: User,
};

export default function AuditTrailView({ entries, onBack }: { entries: AuditEntry[]; onBack: () => void }) {
  return (
    <section className="audit-view" aria-label="Audit trail">
      <header className="audit-view-header">
        <button type="button" className="dashboard-icon-button" aria-label="Back to profile" onClick={onBack}><ArrowLeft size={20} /></button>
        <h1>Audit Trail</h1>
      </header>
      <h2 className="audit-category">Security &amp; Configuration</h2>
      {entries.length === 0 && <p className="profile-empty">No audit entries match your search.</p>}
      <ul className="audit-cards">
        {entries.map((entry) => {
          const Icon = icons[entry.icon];
          return (
            <li key={entry.id} className="dashboard-card audit-card">
              <div className="audit-card-top"><h3>{entry.title}</h3><Icon size={16} /></div>
              <p>{entry.description}</p>
              <p className="audit-by">By: {entry.by}</p>
              <p className="audit-time"><Clock3 size={13} />{entry.time}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
