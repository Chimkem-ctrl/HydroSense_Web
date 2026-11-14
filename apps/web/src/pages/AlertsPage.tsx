import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatManilaDateTime, validateAcknowledgeNote } from '@hydrosense/shared';
import type { AlertItem } from '@hydrosense/shared';
import { api } from '../app/api';
import { useRole } from '../app/auth/RoleContext';
import { useSelectedTank } from '../app/tank/TankContext';
import { usePendingRequests, useTanks } from '../app/data/hooks';
import { PageHeading } from '../components/common/PageHeading';
import { StatusBadge } from '../components/readings/StatusBadge';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

type AlertTab = AlertItem['status'];
const tabs: Array<{ key: AlertTab; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' },
];

export default function AlertsPage() {
  const { role, userName } = useRole();
  const { tankId } = useSelectedTank();
  const tanks = useTanks();
  const pendingRequests = usePendingRequests();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AlertTab>('open');
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [resolveDialog, setResolveDialog] = useState(false);
  const query = useQuery({ queryKey: ['alerts', tankId], queryFn: () => api.listAlerts(tankId), enabled: Boolean(tankId) });
  const responses = useQuery({
    queryKey: ['alert-responses', selected?.id],
    queryFn: () => api.listAlertResponses(selected!.id),
    enabled: Boolean(selected),
  });
  const mutation = useMutation({
    mutationFn: async ({ alertId, resolve }: { alertId: string; resolve: boolean }) => {
      const input = { note: note.trim(), user: userName };
      if (!resolve) return api.acknowledgeAlert(alertId, input);
      const alert = await api.resolveAlert(alertId, input);
      await api.createActivityLog({
        tankId: alert.tankId,
        kind: 'ALERT RESOLUTION',
        type: `Resolved: ${alert.parameter}`,
        operator: userName,
        notes: input.note,
      });
      return alert;
    },
    onSuccess: async () => {
      setSelected(null);
      setNote('');
      setResolveDialog(false);
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['alert-responses'] });
      await queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
  const items = (query.data ?? []).filter((alert) => alert.status === tab);
  const tankNames = new Map((tanks.data ?? []).map((tank) => [tank.id, tank.name]));

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelected(null);
        setResolveDialog(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selected]);

  function submitResponse(resolve: boolean) {
    const issues = validateAcknowledgeNote(note);
    if (issues.length) { setFormError(issues[0].message); return; }
    if (!selected) return;
    setFormError('');
    mutation.mutate({ alertId: selected.id, resolve });
  }

  return (
    <div className="stack">
      <PageHeading title="Alerts center" description="Review open alerts, record acknowledgement notes and view response history." />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      <div className="tabs" role="tablist" aria-label="Alert status">
        {tabs.map((item) => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className="tab" onClick={() => setTab(item.key)}>{item.label} ({(query.data ?? []).filter((alert) => alert.status === item.key).length + (item.key === 'open' && role === 'admin' ? (pendingRequests.data?.length ?? 0) : 0)})</button>)}
      </div>
      {role === 'admin' && tab === 'open' && (pendingRequests.isLoading || pendingRequests.isError || Boolean(pendingRequests.data?.length)) && (
        <section className="card stack" aria-label="Pending account requests">
          <h2 className="card-title">Pending account requests</h2>
          {pendingRequests.isLoading ? <LoadingState label="Loading account requests" /> : pendingRequests.isError ? <ErrorState error={pendingRequests.error} onRetry={() => void pendingRequests.refetch()} /> : pendingRequests.data?.map((request) => (
            <div key={request.id}>
              <strong>New account request: {request.firstName} {request.lastName}</strong>
              <p className="small muted">Submitted {formatManilaDateTime(request.createdAt)} PHT</p>
            </div>
          ))}
          {!pendingRequests.isLoading && !pendingRequests.isError && <Link className="button" to="/admin/users">Review account requests</Link>}
        </section>
      )}
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : items.length === 0 ? <EmptyState>{`No ${tab} alerts for the selected tank.`}</EmptyState> : (
        <section className="stack">
          {items.map((alert) => (
            <article className="card" key={alert.id}>
              <div className="inline" style={{ justifyContent: 'space-between' }}>
                <h2 className="card-title">{alert.parameter} · {alert.value}</h2>
                <StatusBadge level={alert.severity === 'critical' ? 'critical' : 'warning'} label={alert.severity} />
              </div>
              <p>{alert.threshold} · {formatManilaDateTime(alert.createdAt)} PHT</p>
              <p className="small muted">Tank: {tankNames.get(alert.tankId) ?? 'Unknown tank'}{alert.acknowledgedBy ? ` · Acknowledged by ${alert.acknowledgedBy}` : ''}</p>
              <div className="inline">
                <button type="button" className="button" onClick={() => { setSelected(alert); setNote(''); setFormError(''); }}>Response history / respond</button>
                {alert.status === 'open' && <button type="button" className="button button-primary" onClick={() => { setSelected(alert); setNote(''); setFormError(''); }}>Acknowledge</button>}
              </div>
            </article>
          ))}
        </section>
      )}
      {selected && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="dialog card stack" role="dialog" aria-modal="true" aria-labelledby="alert-response-title">
            <header><h2 id="alert-response-title" className="card-title">Alert response history</h2><p>{selected.parameter} · {tankNames.get(selected.tankId) ?? 'Unknown tank'} · {selected.threshold}</p></header>
            {responses.isLoading ? <LoadingState label="Loading response history" /> : responses.isError ? <ErrorState error={responses.error} onRetry={() => void responses.refetch()} /> : (responses.data ?? []).length ? (
              <ol>{responses.data?.map((response) => <li key={response.id}><b>{response.status}</b> · {response.createdBy} · {formatManilaDateTime(response.createdAt)} PHT<p>{response.note}</p></li>)}</ol>
            ) : <EmptyState>No response history has been recorded.</EmptyState>}
            {selected.status === 'open' && (
              <label className="field">Acknowledgement note<textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="What did you observe or verify?" /></label>
            )}
            {formError && <p className="state-error" role="alert">{formError}</p>}
            {mutation.isError && <ErrorState error={mutation.error} />}
            <footer className="inline">
              <button className="button" type="button" onClick={() => setSelected(null)}>Close</button>
              {selected.status === 'open' && <button className="button button-primary" type="button" disabled={mutation.isPending} onClick={() => submitResponse(false)}>Acknowledge alert</button>}
              {selected.status === 'acknowledged' && role !== 'operator' && <button className="button button-primary" type="button" disabled={mutation.isPending} onClick={() => setResolveDialog(true)}>Resolve alert</button>}
              {resolveDialog && (
                <span className="resolve-inline">
                  <label className="field">Resolution note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record the verification result" /></label>
                  <button className="button button-primary" type="button" disabled={mutation.isPending} onClick={() => submitResponse(true)}>Confirm resolve</button>
                </span>
              )}
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
