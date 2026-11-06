import { useEffect } from 'react';
import GlassPanel from '../common/GlassPanel';

interface AuditTrailModalProps {
  open: boolean;
  onClose: () => void;
}

const AUDIT_ENTRIES = [
  { time: 'Today, 09:14', actor: 'Hatchery Staff', action: 'Signed in from iPhone 17' },
  { time: 'Today, 08:50', actor: 'Hatchery Staff', action: 'Requested sensor calibration' },
  { time: 'Yesterday, 17:32', actor: 'Dario Minoza', action: 'Changed pH alert threshold' },
  { time: 'Yesterday, 11:05', actor: 'Dario Minoza', action: 'Shared diagnostic logs' },
];

export default function AuditTrailModal({ open, onClose }: AuditTrailModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <GlassPanel className="terms-modal audit-trail-modal">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-trail-title"
          onClick={(event) => event.stopPropagation()}
        >
          <h2 id="audit-trail-title">Account Audit Trail</h2>
          <ul className="audit-list">
            {AUDIT_ENTRIES.map((entry) => (
              <li key={`${entry.time}-${entry.action}`}>
                <span className="settings-muted">{entry.time}</span>
                <span>
                  <strong>{entry.actor}</strong> &mdash; {entry.action}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}
