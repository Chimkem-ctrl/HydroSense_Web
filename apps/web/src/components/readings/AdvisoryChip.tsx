import { HelpCircle, Info } from 'lucide-react';
import { useState } from 'react';
import type { AdvisoryState } from '@hydrosense/shared';

const levelLabel = { low: 'Low', watch: 'Watch', high: 'High' } as const;
const kindLabel = { salinity: 'Salinity', ammonia: 'Ammonia' } as const;

export function AdvisoryChip({ advisory }: { advisory: AdvisoryState }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="advisory-wrap" style={{ position: 'relative' }}>
      <button
        type="button"
        className={`advisory-chip advisory-${advisory.level}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={15} aria-hidden="true" />
        <span>Advisory · {kindLabel[advisory.kind]} · {levelLabel[advisory.level]}</span>
        <HelpCircle size={15} aria-hidden="true" />
      </button>
      {open && (
        <span className="popover" role="dialog" aria-label={`Why ${kindLabel[advisory.kind]} advisory is ${levelLabel[advisory.level]}`}>
          <strong>Why this level?</strong>
          {advisory.kind === 'salinity' && <p>Reference target: 28–33 ppt. This target is not a sensor measurement.</p>}
          <p>{advisory.firedRule}</p>
          <dl>
            {Object.entries(advisory.inputs).map(([key, value]) => (
              <span key={key} style={{ display: 'contents' }}><dt>{key}</dt><dd>{value}</dd></span>
            ))}
          </dl>
          <small className="muted">Advisory only — not a sensor measurement.</small>
        </span>
      )}
    </span>
  );
}
