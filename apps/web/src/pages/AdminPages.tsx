import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatManilaDateTime } from '@hydrosense/shared';
import type { Role } from '@hydrosense/shared';
import { api } from '../app/api';
import { tierConfig } from '../app/config';
import { useRole } from '../app/auth/RoleContext';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

export function AdminUsersPage() {
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => api.listUsers(), enabled: tierConfig.teamAccounts });
  const mutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.updateUserRole(userId, role, userName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
  return (
    <div className="stack">
      <PageHeading title="Users & roles" description={`Team accounts · tier node limit ${tierConfig.nodeLimit}. Role changes apply to the frontend mock API only until the backend is connected.`} />
      <StaleQueryState updatedAt={users.dataUpdatedAt} />
      {!tierConfig.teamAccounts ? <section className="card"><h2 className="card-title">Team accounts require an upgrade</h2><p className="muted">Team account management is available on premium and enterprise tiers.</p></section> : users.isLoading ? <LoadingState /> : users.isError ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : !users.data?.length ? <EmptyState>No team users are registered.</EmptyState> : (
        <section className="card">
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Site</th><th>Role</th><th>Last active</th></tr></thead><tbody>
            {users.data.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.site}</td><td><label className="field"><span className="sr-only">Role for {user.name}</span><select value={user.role} onChange={(event) => mutation.mutate({ userId: user.id, role: event.target.value as Role })}><option value="operator">Operator</option><option value="manager">Manager</option><option value="admin">Admin</option></select></label></td><td>{formatManilaDateTime(user.lastActive)} PHT</td></tr>)}
          </tbody></table></div>
          {mutation.isError && <ErrorState error={mutation.error} />}
        </section>
      )}
    </div>
  );
}

export function AdminLogsPage() {
  const query = useQuery({ queryKey: ['audit-logs'], queryFn: () => api.listAuditLogs() });
  return (
    <div className="stack">
      <PageHeading title="Audit & system logs" description="Administrative actions and operational events, timestamped in Asia/Manila." />
      <StaleQueryState updatedAt={query.dataUpdatedAt} />
      {query.isLoading ? <LoadingState /> : query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !query.data?.length ? <EmptyState>No audit or system logs are available.</EmptyState> : (
        <section className="card"><div className="table-wrap"><table><thead><tr><th>Time (PHT)</th><th>User</th><th>Action</th><th>Detail</th></tr></thead><tbody>{query.data.map((log) => <tr key={log.id}><td>{formatManilaDateTime(log.timestamp)}</td><td>{log.user}</td><td>{log.action}</td><td>{log.detail}</td></tr>)}</tbody></table></div></section>
      )}
    </div>
  );
}

export function NotificationSettingsPage() {
  const [values, setValues] = useState({ sms: false, email: tierConfig.emailAlerts, voice: false });
  const channels = [
    { key: 'sms' as const, label: 'SMS alerts', available: tierConfig.smsAlerts },
    { key: 'email' as const, label: 'Email alerts', available: tierConfig.emailAlerts },
    { key: 'voice' as const, label: 'Voice alerts', available: tierConfig.voiceAlerts },
  ];
  return (
    <div className="stack">
      <PageHeading title="Alert preferences" description="Notification channel availability depends on the configured service tier." />
      <section className="card stack">
        {channels.map(({ key, label, available }) => <label key={key} className="check-row"><input type="checkbox" checked={values[key]} disabled={!available} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.checked }))} /><span>{label}</span>{!available && <small className="muted">Upgrade to premium or enterprise to enable this channel.</small>}</label>)}
        <p className="small muted">Pilot preference only; delivery integrations require the backend.</p>
      </section>
    </div>
  );
}

export function ComingSoonPage({ feature }: { feature: string }) {
  const available = feature.toLowerCase().includes('fleet') ? tierConfig.fleetView : tierConfig.batchTracking;
  return <section className="card stack"><PageHeading title={`${feature} · Coming soon`} description={available ? 'This Enterprise feature is planned but not available in the pilot dashboard.' : 'This feature requires the Enterprise tier.'} /><p className="muted">No batch or fleet data is displayed until the feature is implemented.</p></section>;
}
