import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatManilaDateTime } from '@hydrosense/shared';
import type { DashboardUser, Role } from '@hydrosense/shared';
import { api } from '../app/api';
import { ROLE_LABELS, tierConfig } from '../app/config';
import { useRole } from '../app/auth/RoleContext';
import { authService, SUBSCRIBED_HATCHERIES } from '../services/authService';
import type { RequestedRole } from '../types/auth.types';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState, ErrorState, LoadingState, StaleQueryState } from '../components/common/States';

export function AdminUsersPage() {
  const { userName } = useRole();
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const apiUsers = await api.listUsers();
      const accountUsers: DashboardUser[] = authService.listApprovedUsers().map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        site: user.hatcheryId
          ? SUBSCRIBED_HATCHERIES.find((hatchery) => hatchery.id === user.hatcheryId)?.name ?? user.hatcheryId
          : 'HydroSense',
        active: true,
        lastActive: user.createdAt,
        employeeId: user.employeeId,
        phone: user.phone,
        position: user.position,
        address: user.address,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
      }));
      const accountEmails = new Set(accountUsers.map((user) => user.email.toLowerCase()));
      return [...apiUsers.filter((user) => !accountEmails.has(user.email.toLowerCase())), ...accountUsers];
    },
    enabled: tierConfig.teamAccounts,
  });
  const pendingRequests = useQuery({ queryKey: ['pending-requests'], queryFn: () => authService.listPendingRequests() });
  const [selectedRoles, setSelectedRoles] = useState<Record<string, RequestedRole>>({});
  const mutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Exclude<Role, 'admin'> }) => {
      if (userId.startsWith('account-')) {
        return authService.updateApprovedUserRole(userId, role);
      }
      return api.updateUserRole(userId, role, userName);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    },
  });
  const approveRequest = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: RequestedRole }) => authService.approveRequest(userId, role),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  const rejectRequest = useMutation({
    mutationFn: async (userId: string) => authService.rejectRequest(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-requests'] });
    },
  });
  return (
    <div className="stack">
      <PageHeading title="Users & roles" description={`Team accounts · tier node limit ${tierConfig.nodeLimit}. Role changes apply to the frontend mock API only until the backend is connected.`} />
      <StaleQueryState updatedAt={users.dataUpdatedAt} />
      <section className="card">
        <h2 className="card-title">Pending requests</h2>
        {pendingRequests.isLoading ? <LoadingState /> : pendingRequests.isError ? <ErrorState error={pendingRequests.error} onRetry={() => void pendingRequests.refetch()} /> : !pendingRequests.data?.length ? <EmptyState>No account requests are awaiting review.</EmptyState> : (
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Employee ID</th><th>Position</th><th>Hatchery</th><th>Requested role</th><th>Date</th><th>Review</th></tr></thead><tbody>
            {pendingRequests.data.map((request) => (
              <tr key={request.id}>
                <td>{request.firstName} {request.lastName}</td>
                <td>{request.email}</td>
                <td>{request.employeeId ?? '—'}</td>
                <td>{request.position ?? '—'}</td>
                <td>{SUBSCRIBED_HATCHERIES.find((hatchery) => hatchery.id === request.hatcheryId)?.name ?? '—'}</td>
                <td>{ROLE_LABELS[request.requestedRole]}</td>
                <td>{formatManilaDateTime(request.createdAt)} PHT</td>
                <td>
                  <div className="inline">
                    <label className="field"><span className="sr-only">Approval role for {request.firstName} {request.lastName}</span>
                      <select value={selectedRoles[request.id] ?? request.requestedRole} onChange={(event) => setSelectedRoles((roles) => ({ ...roles, [request.id]: event.target.value as RequestedRole }))}>
                        <option value="operator">Operator</option><option value="manager">Manager</option>
                      </select>
                    </label>
                    <button type="button" className="button button-primary" disabled={approveRequest.isPending || rejectRequest.isPending} onClick={() => approveRequest.mutate({ userId: request.id, role: selectedRoles[request.id] ?? request.requestedRole })}>Approve</button>
                    <button type="button" className="button" disabled={approveRequest.isPending || rejectRequest.isPending} onClick={() => {
                      if (window.confirm(`Reject the account request for ${request.firstName} ${request.lastName}?`)) rejectRequest.mutate(request.id);
                    }}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {approveRequest.isError && <ErrorState error={approveRequest.error} />}
        {rejectRequest.isError && <ErrorState error={rejectRequest.error} />}
      </section>
      {!tierConfig.teamAccounts ? <section className="card"><h2 className="card-title">Team accounts require an upgrade</h2><p className="muted">Team account management is available on premium and enterprise tiers.</p></section> : users.isLoading ? <LoadingState /> : users.isError ? <ErrorState error={users.error} onRetry={() => void users.refetch()} /> : !users.data?.length ? <EmptyState>No team users are registered.</EmptyState> : (
        <section className="card">
          <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Site</th><th>Role</th><th>Last active</th></tr></thead><tbody>
            {users.data.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.site}</td><td>{user.role === 'admin' ? <span>Admin</span> : <label className="field"><span className="sr-only">Role for {user.name}</span><select value={user.role} onChange={(event) => mutation.mutate({ userId: user.id, role: event.target.value as Exclude<Role, 'admin'> })}><option value="operator">Operator</option><option value="manager">Manager</option></select></label>}</td><td>{formatManilaDateTime(user.lastActive)} PHT</td></tr>)}
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

export function ComingSoonPage({ feature }: { feature: string }) {
  const available = feature.toLowerCase().includes('fleet') ? tierConfig.fleetView : tierConfig.batchTracking;
  return <section className="card stack"><PageHeading title={`${feature} · Coming soon`} description={available ? 'This Enterprise feature is planned but not available in the pilot dashboard.' : 'This feature requires the Enterprise tier.'} /><p className="muted">No batch or fleet data is displayed until the feature is implemented.</p></section>;
}
