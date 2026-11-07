import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { sessionService } from '../../services/sessionService';
import ProfileCard from '../../components/profile/ProfileCard';
import SecurityCard from '../../components/profile/SecurityCard';
import DevicesCard from '../../components/profile/DevicesCard';
import AdminManagement from '../../components/profile/AdminManagement';
import AuditTrailView from '../../components/profile/AuditTrailView';
import {
  CURRENT_USER_EMAIL,
  defaultProfile,
  formatAuditTime,
  getInitials,
  initialAudit,
  initialUsers,
  usePersistentState,
} from '../../components/profile/profileData';
import type { AuditEntry, AuditIcon, ManagedUser, ProfileData } from '../../components/profile/profileData';

export default function ProfilePage() {
  const [profile, setProfile] = usePersistentState<ProfileData>('hydrosense.profile', defaultProfile);
  const [avatarUrl, setAvatarUrl] = usePersistentState('hydrosense.avatar', '');
  const [users, setUsers] = usePersistentState<ManagedUser[]>('hydrosense.profile.users', initialUsers);
  const [audit, setAudit] = usePersistentState<AuditEntry[]>('hydrosense.audit', initialAudit);
  const [view, setView] = useState<'profile' | 'audit'>('profile');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const log = (title: string, description: string, icon: AuditIcon) =>
    setAudit((entries) => [
      {
        id: `a${Date.now()}`,
        category: 'Security & Configuration',
        title,
        description,
        by: `${CURRENT_USER_EMAIL} (Admin)`,
        time: formatAuditTime(),
        icon,
      },
      ...entries,
    ]);

  function changeUserStatus(id: string, status: ManagedUser['status']) {
    const target = users.find((user) => user.id === id);
    if (!target) return;
    setUsers((list) => list.map((user) => (user.id === id ? { ...user, status } : user)));
    const verb = status === 'active' ? (target.status === 'pending' ? 'Approved' : 'Reactivated') : 'Deactivated';
    log(`User Account ${verb}`, `${verb} ${target.email} as ${target.role}`, 'user');
    setNotice(`${target.name} ${verb.toLowerCase()}.`);
  }

  function saveProfile(next: ProfileData) {
    setProfile(next);
    log('Profile Updated', 'Profile details were edited', 'user');
  }

  const query = search.trim().toLowerCase();
  const visibleUsers = users.filter((user) => `${user.email} ${user.name} ${user.role}`.toLowerCase().includes(query));
  const visibleAudit = audit.filter((entry) => `${entry.title} ${entry.description} ${entry.by}`.toLowerCase().includes(query));

  return (
    <AppShell
      pageTitle={view === 'audit' ? 'Audit Trail' : 'Profile'}
      displayName={profile.name}
      initials={getInitials(profile.name)}
      avatarUrl={avatarUrl}
      profileActive
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder={view === 'audit' ? 'Search audit trail...' : 'Search users...'}
    >
      {view === 'audit' ? (
        <AuditTrailView entries={visibleAudit} onBack={() => { setView('profile'); setSearch(''); }} />
      ) : (
        <>
          <section className="dashboard-welcome">
            <div>
              <p className="dashboard-kicker">ACCOUNT · ADMINISTRATION</p>
              <h1>Profile<span>.</span></h1>
              <p>Manage your account, security, devices and team access.</p>
            </div>
          </section>
          <div className="profile-grid">
            <ProfileCard profile={profile} avatarUrl={avatarUrl} onSave={saveProfile} onAvatarChange={setAvatarUrl} onNotice={setNotice} />
            <SecurityCard onViewAudit={() => { setView('audit'); setSearch(''); }} onNotice={setNotice} onLog={log} />
            <DevicesCard />
          </div>
          {sessionService.get()?.role === 'admin' && <AdminManagement users={visibleUsers} onChange={changeUserStatus} />}
        </>
      )}
      {notice && (
        <div className="dashboard-toast" role="status">
          <Check size={15} /><span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice('')}><X size={14} /></button>
        </div>
      )}
    </AppShell>
  );
}
