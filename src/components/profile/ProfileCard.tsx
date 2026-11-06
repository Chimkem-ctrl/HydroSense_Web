import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Camera, Check, Mail, MapPin, Pencil, Phone, Trash2, X } from 'lucide-react';
import { getInitials, usePersistentState } from './profileData';
import type { ProfileData } from './profileData';

interface ProfileCardProps {
  profile: ProfileData;
  avatarUrl: string;
  onSave: (profile: ProfileData) => void;
  onAvatarChange: (url: string) => void;
  onNotice: (message: string) => void;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="profile-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="checkbox" role="switch" className="profile-switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </div>
  );
}

export default function ProfileCard({ profile, avatarUrl, onSave, onAvatarChange, onNotice }: ProfileCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});
  const [photoError, setPhotoError] = useState('');
  const [prefs, setPrefs] = usePersistentState('hydrosense.prefs', { critical: true, weekly: false, maintenance: false });

  function startEdit() {
    setDraft(profile);
    setErrors({});
    setEditing(true);
  }

  function validate(values: ProfileData) {
    const next: Partial<Record<keyof ProfileData, string>> = {};
    if (!values.name.trim()) next.name = 'Full name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (!/^\+?[0-9\s-]{7,20}$/.test(values.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!values.location.trim()) next.location = 'Location is required.';
    return next;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = validate(draft);
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim(), location: draft.location.trim() });
    setEditing(false);
    onNotice('Profile details updated.');
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Image must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoError('');
      onAvatarChange(String(reader.result));
      onNotice('Profile photo updated.');
    };
    reader.onerror = () => setPhotoError('Could not read that image.');
    reader.readAsDataURL(file);
  }

  const field = (key: keyof ProfileData, label: string, type = 'text') => (
    <label className="profile-field">
      <span>{label}</span>
      <input type={type} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} aria-invalid={Boolean(errors[key])} />
      {errors[key] && <small role="alert">{errors[key]}</small>}
    </label>
  );

  return (
    <section className="dashboard-card profile-card" aria-label="Profile">
      <div className="profile-identity">
        <div className="profile-avatar-wrap">
          <span className="dashboard-avatar profile-avatar-lg">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="avatar-image" /> : getInitials(profile.name)}
          </span>
          <button type="button" className="profile-avatar-edit" aria-label="Attach profile photo" onClick={() => fileRef.current?.click()}>
            <Camera size={13} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
        </div>
        <div className="profile-identity-text">
          <h2>{profile.name}</h2>
          <p>System Administrator</p>
          {avatarUrl && (
            <button type="button" className="profile-text-button" onClick={() => { onAvatarChange(''); onNotice('Profile photo removed.'); }}>
              <Trash2 size={11} /> Remove photo
            </button>
          )}
          {photoError && <small className="profile-error" role="alert">{photoError}</small>}
        </div>
        {!editing && (
          <button type="button" className="dashboard-button dashboard-button--primary profile-edit-button" onClick={startEdit}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      <h3 className="profile-section-title">Profile Details</h3>
      {editing ? (
        <form className="profile-box profile-form" onSubmit={submit} noValidate>
          {field('name', 'Full name')}
          {field('email', 'Email', 'email')}
          {field('phone', 'Phone', 'tel')}
          {field('location', 'Location')}
          <div className="profile-form-actions">
            <button type="button" className="dashboard-button dashboard-button--subtle" onClick={() => setEditing(false)}><X size={12} /> Cancel</button>
            <button type="submit" className="dashboard-button dashboard-button--primary"><Check size={12} /> Save changes</button>
          </div>
        </form>
      ) : (
        <div className="profile-box">
          <p className="profile-info"><Mail size={14} />{profile.email}</p>
          <p className="profile-info"><Phone size={14} />{profile.phone}</p>
          <p className="profile-info"><MapPin size={14} />{profile.location}</p>
        </div>
      )}

      <h3 className="profile-section-title">Notification Preferences</h3>
      <div className="profile-box">
        <Toggle id="pref-critical" label="Critical Alerts" checked={prefs.critical} onChange={(v) => setPrefs({ ...prefs, critical: v })} />
        <Toggle id="pref-weekly" label="Weekly Reports" checked={prefs.weekly} onChange={(v) => setPrefs({ ...prefs, weekly: v })} />
        <Toggle id="pref-maintenance" label="Maintenance Reminders" checked={prefs.maintenance} onChange={(v) => setPrefs({ ...prefs, maintenance: v })} />
      </div>

      <h3 className="profile-section-title">Maintenance Actions</h3>
      <div className="profile-box profile-actions">
        <button type="button" className="profile-danger" onClick={() => onNotice('Sensor calibration requested.')}>Request Calibrate Sensors</button>
        <button type="button" className="profile-danger" onClick={() => onNotice('Hardware node reboot requested.')}>Request Reboot Hardware Node</button>
      </div>
    </section>
  );
}
