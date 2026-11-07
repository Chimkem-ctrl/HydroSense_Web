import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading data…' }: { label?: string }) {
  return <div className="state-box" role="status"><LoaderCircle size={18} aria-hidden="true" /> {label}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Data could not be loaded.';
  return (
    <div className="state-box state-error" role="alert">
      <AlertCircle size={18} aria-hidden="true" /> {message}
      {onRetry && <button className="button" type="button" onClick={onRetry}><RefreshCw size={15} /> Retry</button>}
    </div>
  );
}

export function EmptyState({ children }: { children: string }) {
  return <div className="state-box" role="status">{children}</div>;
}

export function StaleState({ updatedAt }: { updatedAt: number }) {
  const hours = Math.max(1, Math.floor((Date.now() - updatedAt) / 3_600_000));
  return <span className="state-stale"><AlertCircle size={14} /> Stale · last updated {hours} h ago</span>;
}

export function StaleQueryState({ updatedAt }: { updatedAt: number }) {
  return updatedAt > 0 && Date.now() - updatedAt > 3 * 3_600_000
    ? <StaleState updatedAt={updatedAt} />
    : null;
}
