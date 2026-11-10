import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { formatManilaDateTime } from '@hydrosense/shared';
import type { AlertItem } from '@hydrosense/shared';
import { api } from '../../app/api';
import { useRole } from '../../app/auth/RoleContext';
import { ErrorState } from '../common/States';

export const CRITICAL_ACK_NOTE = 'Acknowledged from the critical alert pop-up.';

export function CriticalAlertModal({ alert, remaining }: { alert: AlertItem; remaining: number }) {
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const mutation = useMutation({
    mutationFn: () => api.acknowledgeAlert(alert.id, { note: CRITICAL_ACK_NOTE, user: userName }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['alert-responses'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });

  useEffect(() => {
    buttonRef.current?.focus();
  }, [alert.id]);

  return (
    <div className="critical-modal-backdrop" role="presentation">
      <section className="critical-modal" role="alertdialog" aria-modal="true" aria-labelledby="critical-alert-title" aria-describedby="critical-alert-desc">
        <span className="critical-modal-icon"><AlertTriangle size={24} aria-hidden="true" /></span>
        <h2 id="critical-alert-title">Critical alert</h2>
        <p id="critical-alert-desc">
          <b>{alert.parameter}</b> is at <b>{alert.value}</b> in {alert.tankId}. Threshold: {alert.threshold}.
        </p>
        <p className="critical-modal-meta">Raised {formatManilaDateTime(alert.createdAt)} PHT{remaining > 1 ? ` · ${remaining - 1} more critical ${remaining - 1 === 1 ? 'alert' : 'alerts'} waiting` : ''}</p>
        {mutation.isError && <ErrorState error={mutation.error} />}
        <button ref={buttonRef} type="button" className="button button-primary critical-modal-action" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Acknowledging…' : 'Acknowledge'}
        </button>
      </section>
    </div>
  );
}
