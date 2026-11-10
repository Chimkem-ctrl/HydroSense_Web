import { useSearchParams } from 'react-router-dom';
import { formatManilaDateTime } from '@hydrosense/shared';
import { useAuth, useRole } from '../app/auth/RoleContext';
import { SUBSCRIBED_HATCHERIES } from '../services/authService';
import { PageHeading } from '../components/common/PageHeading';
import { EmptyState } from '../components/common/States';
import { AlertPreferencesPanel } from '../components/settings/AlertPreferencesPanel';
   import { AppearancePanel } from '../components/settings/AppearancePanel';

type ProfileTab = 'details' | 'alerts' | 'appearance';

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ProfileTab = tabParam === 'alerts' || tabParam === 'appearance' ? tabParam : 'details';
  const selectTab = (next: ProfileTab) => setSearchParams(next === 'details' ? {} : { tab: next }, { replace: true });
  const { role, userName } = useRole();
  const user = useAuth();
  const hatcheryName = user?.hatcheryId
    ? SUBSCRIBED_HATCHERIES.find((hatchery) => hatchery.id === user.hatcheryId)?.name ?? user.hatcheryId
    : 'HydroSense';
  return (
    <div className="stack">
      <PageHeading title="My profile" description="Your account, role, hatchery assignment and alert preferences." />
      <div className="tabs" role="tablist" aria-label="Profile sections">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'details'} onClick={() => selectTab('details')}>Details</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'alerts'} onClick={() => selectTab('alerts')}>Alert preferences</button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'appearance'} onClick={() => selectTab('appearance')}>Appearance</button>
      </div>
      {tab === 'alerts' ? <AlertPreferencesPanel /> : tab === 'appearance' ? <AppearancePanel /> : !user ? <EmptyState>Profile details are not available for this account.</EmptyState> : (
        <section className="card stack">
          <div className="inline"><span className="avatar" aria-hidden="true">{userName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><h2 className="card-title">{userName}</h2><p className="small muted">{user.position ?? 'Team member'} · {role}</p></div></div>
          <h3>Profile details</h3>
          <dl className="profile-details">
            <div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Employee ID</dt><dd>{user.employeeId ?? 'Not provided'}</dd></div>
            <div><dt>Phone</dt><dd>{user.phone ?? 'Not provided'}</dd></div><div><dt>Role</dt><dd>{role}</dd></div>
            <div><dt>Position</dt><dd>{user.position ?? 'Not provided'}</dd></div><div><dt>Hatchery / site</dt><dd>{hatcheryName}</dd></div>
            <div><dt>Address</dt><dd>{user.address ?? 'Not provided'}</dd></div><div><dt>Account status</dt><dd>{user.status}</dd></div>
            <div><dt>Emergency contact</dt><dd>{user.emergencyContactName ?? 'Not provided'}</dd></div><div><dt>Emergency contact phone</dt><dd>{user.emergencyContactPhone ?? 'Not provided'}</dd></div>
            <div><dt>Account created</dt><dd>{formatManilaDateTime(user.createdAt)} PHT</dd></div>
          </dl>
          <p className="small muted">Profile details are read-only demo data; edits require the future authentication backend.</p>
        </section>
      )}
    </div>
  );
}
