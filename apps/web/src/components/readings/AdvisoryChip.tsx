import { HelpCircle, Info } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { AdvisoryState } from '@hydrosense/shared';
import { AdvisoryEvidence } from './AdvisoryEvidence';

const levelLabel = { low: 'Low', watch: 'Watch', high: 'High' } as const;
const kindLabel = { salinity: 'Salinity', ammonia: 'Ammonia' } as const;

export function AdvisoryChip({ advisory, tankId }: { advisory: AdvisoryState; tankId: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const detailId = useId();
  return (
    <div className="advisory-wrap" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) { setOpen(false); button.current?.focus(); }
    }}>
      <button
        ref={button}
        type="button"
        className={`advisory-chip advisory-${advisory.level}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? detailId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Info size={15} aria-hidden="true" />
        <span>Advisory · {kindLabel[advisory.kind]} · {levelLabel[advisory.level]}</span>
        <HelpCircle size={15} aria-hidden="true" />
      </button>
      {open && (
        <div id={detailId} className="popover" role="dialog" tabIndex={0} aria-label={`Why ${kindLabel[advisory.kind]} advisory is ${levelLabel[advisory.level]}`}>
          <strong>Why this level?</strong>
          {advisory.kind === 'salinity' && <p>Reference target: 28–33 ppt. This target is not a sensor measurement.</p>}
          <p>{advisory.firedRule}</p>
          <dl>
            {Object.entries(advisory.inputs).map(([key, value]) => (
              <span key={key} style={{ display: 'contents' }}><dt>{key}</dt><dd>{value}</dd></span>
            ))}
          </dl>
          <small className="muted">Advisory only — not a sensor measurement.</small>
          <AdvisoryEvidence tankId={tankId} kind={advisory.kind} />
          <button type="button" className="button" onClick={() => { setOpen(false); button.current?.focus(); }}>Close explanation</button>
        </div>
      )}
    </div>
  );
}
