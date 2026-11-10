import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Dialog, Portal } from 'react-native-paper';
import { ChevronDown, Eye, EyeOff } from 'lucide-react-native';
import { ADDRESS_PROVINCES, EMPTY_SIGNUP_ADDRESS, addressBarangays, addressCities, formatSignupPhone } from '@hydrosense/shared';
import type { PhoneCountryCode } from '@hydrosense/shared';
import type { RootStackParamList } from './navigation';
import { Brand, Button, Card, createFormStyles, Page, Title } from './components/ui';
import { PhoneField } from './components/PhoneField';
import { useTheme } from './theme';
import { useSession } from './state';
import { API_BASE_URL, API_KEY, DATA_MODE } from './services/client';
import { authenticate, HATCHERY, requestAccount, requestPasswordReset, validateSignIn } from './services/auth';
import type { SignUpValues } from './services/auth';

type Props<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

function AuthField({ label, value, onChange, placeholder, secure, keyboard }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboard?: 'default' | 'email-address' | 'phone-pad';
}) {
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  const [showPassword, setShowPassword] = useState(false);
  return <View style={ui.formField}>
    <Text style={ui.label}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
      <TextInput accessibilityLabel={label} style={[ui.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboard ?? 'default'} secureTextEntry={secure && !showPassword}
        autoCapitalize={secure || keyboard === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={!secure && keyboard !== 'email-address'} />
      {secure && <Pressable accessibilityRole="button" accessibilityLabel={`${showPassword ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onPress={() => setShowPassword((shown) => !shown)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        {showPassword ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
      </Pressable>}
    </View>
  </View>;
}

function Message({ text }: { text: string }) {
  const { colors } = useTheme();
  return text ? <Text accessibilityRole="alert" style={{ color: colors.critical, lineHeight: 20 }}>{text}</Text> : null;
}

function AddressPicker({ label, value, options, disabled, onChange }: { label: string; value: string; options: readonly { id: string; name: string }[]; disabled?: boolean; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((option) => option.id === value);
  return <View style={ui.formField}>
    <Text style={ui.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.name ?? 'Select'}`} accessibilityState={{ disabled, expanded: open }} disabled={disabled}
      onPress={() => { setSearch(''); setOpen(true); }} style={[ui.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: disabled ? 0.5 : 1 }]}>
      <Text style={{ color: selected ? colors.ink : colors.muted, flex: 1 }}>{selected?.name ?? `Select ${label.toLowerCase()}`}</Text><ChevronDown size={20} color={colors.muted} />
    </Pressable>
    <Portal><Dialog visible={open} onDismiss={() => setOpen(false)}>
      <Dialog.Title>{label}</Dialog.Title><Dialog.Content>
        <TextInput accessibilityLabel={`Search ${label}`} style={ui.input} value={search} onChangeText={setSearch} placeholder="Search" placeholderTextColor={colors.muted} />
        <FlatList style={{ height: 300 }} keyboardShouldPersistTaps="handled" data={options.filter((option) => option.name.toLowerCase().includes(search.toLowerCase()))}
          keyExtractor={(item) => item.id} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { onChange(item.id); setOpen(false); }} style={{ padding: 14 }}><Text style={{ color: colors.ink }}>{item.name}</Text></Pressable>} />
      </Dialog.Content><Dialog.Actions><Button label="Cancel" secondary onPress={() => setOpen(false)} /></Dialog.Actions>
    </Dialog></Portal>
  </View>;
}

export function LoginScreen({ navigation }: Props<'Login'>) {
  const { colors } = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const issue = validateSignIn(email, password);
    if (issue) { setError(issue); return; }
    setError('');
    setBusy(true);
    try {
      const result = await authenticate(API_BASE_URL, API_KEY, email, password);
      if ('status' in result) navigation.navigate('PendingApproval');
      else await signIn(result.user, result.accessToken);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function demo(role: 'operator' | 'manager' | 'admin') {
    try {
      setError('');
      await signIn({ id: `demo-${role}`, name: `Demo ${role}`, role });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to start the demo.');
    }
  }

  return <Page auth>
    <Brand />
    <Card>
      <Title centered detail="Sign in to your HydroSense account">Welcome Back</Title>
      {DATA_MODE === 'mock' ? <>
        <Text style={{ color: colors.muted }}>Demo-only access uses sample data and does not authenticate with the backend.</Text>
        <Button label="Continue as demo operator" onPress={() => void demo('operator')} />
        <Button label="Continue as demo manager" secondary onPress={() => void demo('manager')} />
        <Button label="Continue as demo admin" secondary onPress={() => void demo('admin')} />
      </> : <>
        <AuthField label="Email" value={email} onChange={setEmail} keyboard="email-address" placeholder="Enter your email" />
        <AuthField label="Password" value={password} onChange={setPassword} secure placeholder="Enter your password" />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'flex-end', paddingVertical: 8 }}><Text style={{ color: colors.teal, fontWeight: '700' }}>Forgot password?</Text></Pressable>
        <Button label={busy ? 'Signing in…' : 'Sign In'} disabled={busy} onPress={() => void submit()} />
        <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
          Don't have an account?{' '}
          <Text accessibilityRole="link" accessibilityState={{ disabled: busy }} onPress={busy ? undefined : () => navigation.navigate('SignUp')} style={{ color: colors.teal, fontWeight: '700' }}>Sign Up</Text>
        </Text>
      </>}
      <Message text={error} />
    </Card>
  </Page>;
}

const initialValues: SignUpValues = {
  firstName: '', lastName: '', employeeId: '', phone: '', email: '',
  hatcheryId: '', address: EMPTY_SIGNUP_ADDRESS, emergencyContactName: '',
  emergencyContactPhone: '', password: '', confirmPassword: '', termsAccepted: false,
};

export function SignUpScreen({ navigation }: Props<'SignUp'>) {
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  const { width } = useWindowDimensions();
  const [values, setValues] = useState<SignUpValues>(initialValues);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [hatcheryOpen, setHatcheryOpen] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('PH');
  const [emergencyCountry, setEmergencyCountry] = useState<PhoneCountryCode>('PH');
  function setField<K extends keyof SignUpValues>(key: K, value: SignUpValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
  }
  async function submit() {
    setError('');
    setBusy(true);
    try {
      const phone = formatSignupPhone(phoneCountry, values.phone);
      const emergencyContactPhone = formatSignupPhone(emergencyCountry, values.emergencyContactPhone);
      if (values.phone.trim() && !phone) throw new Error('Enter a valid national contact number for the selected country.');
      if (values.emergencyContactPhone.trim() && !emergencyContactPhone) throw new Error('Enter a valid national emergency contact number for the selected country.');
      await requestAccount(API_BASE_URL, API_KEY, { ...values, phone: phone ?? '', emergencyContactPhone: emergencyContactPhone ?? '' });
      navigation.replace('PendingApproval');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return <Page auth>
    <Brand />
    <Card>
      <Title centered detail="Submit your staff details for administrator approval. An administrator will assign your role.">Request an account</Title>
      <View style={{ flexDirection: width >= 600 ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1 }}><AuthField label="First name" value={values.firstName} onChange={(v) => setField('firstName', v)} placeholder="First name" /></View>
        <View style={{ flex: 1 }}><AuthField label="Last name" value={values.lastName} onChange={(v) => setField('lastName', v)} placeholder="Last name" /></View>
      </View>
      <AuthField label="Employee / staff ID" value={values.employeeId} onChange={(v) => setField('employeeId', v)} placeholder="e.g. SAG-OP-014" />
      <PhoneField label="Contact number" value={values.phone} country={phoneCountry} onChange={(v) => setField('phone', v)} onCountryChange={(country) => { setPhoneCountry(country); setError(''); }} />
      <AuthField label="Work email" value={values.email} onChange={(v) => setField('email', v)} keyboard="email-address" placeholder="name@example.com" />
      <View style={ui.formField}>
        <Text style={ui.label}>Subscribed hatchery</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Subscribed hatchery: ${values.hatcheryId ? HATCHERY.name : 'Select a subscribed hatchery'}`}
          accessibilityValue={{ text: values.hatcheryId ? HATCHERY.name : 'Select a subscribed hatchery' }}
          accessibilityState={{ expanded: hatcheryOpen }}
          aria-expanded={hatcheryOpen}
          onPress={() => setHatcheryOpen((open) => !open)}
          style={[ui.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}
        >
          <Text style={{ color: values.hatcheryId ? colors.ink : colors.muted, fontSize: 16, flex: 1 }}>
            {values.hatcheryId ? HATCHERY.name : 'Select a subscribed hatchery'}
          </Text>
          <ChevronDown size={20} color={colors.muted} />
        </Pressable>
        {hatcheryOpen && <View accessibilityRole="radiogroup" accessibilityLabel="Subscribed hatchery options" style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, overflow: 'hidden' }}>
          {[{ id: '', name: 'Select a subscribed hatchery' }, HATCHERY].map((hatchery) => <Pressable
            key={hatchery.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: values.hatcheryId === hatchery.id }}
            aria-checked={values.hatcheryId === hatchery.id}
            onPress={() => { setField('hatcheryId', hatchery.id); setHatcheryOpen(false); }}
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: values.hatcheryId === hatchery.id ? colors.selected : colors.surface }}
          >
            <Text style={{ color: values.hatcheryId === hatchery.id ? colors.teal : colors.ink, fontSize: 15 }}>{hatchery.name}</Text>
          </Pressable>)}
        </View>}
      </View>
      <AddressPicker label="Country" value={values.address.country} options={[{ id: 'PH', name: 'Philippines' }]} onChange={(country) => setField('address', { ...values.address, country, province: '', city: '', barangay: '' })} />
      <AddressPicker label="Province / region" value={values.address.province} disabled={!values.address.country} options={ADDRESS_PROVINCES} onChange={(province) => setField('address', { ...values.address, province, city: '', barangay: '' })} />
      <AddressPicker label="City / municipality / district" value={values.address.city} disabled={!values.address.province} options={addressCities(values.address.province)} onChange={(city) => setField('address', { ...values.address, city, barangay: '' })} />
      <AddressPicker label="Barangay" value={values.address.barangay} disabled={!values.address.city} options={addressBarangays(values.address.city)} onChange={(barangay) => setField('address', { ...values.address, barangay })} />
      <AuthField label="Street address" value={values.address.street} onChange={(street) => setField('address', { ...values.address, street })} placeholder="House number and street" />
      <AuthField label="Emergency contact name" value={values.emergencyContactName} onChange={(v) => setField('emergencyContactName', v)} placeholder="Full name" />
      <PhoneField label="Emergency contact number" value={values.emergencyContactPhone} country={emergencyCountry} onChange={(v) => setField('emergencyContactPhone', v)} onCountryChange={(country) => { setEmergencyCountry(country); setError(''); }} />
      <AuthField label="Password" value={values.password} onChange={(v) => setField('password', v)} secure placeholder="At least 8 characters" />
      <AuthField label="Confirm password" value={values.confirmPassword} onChange={(v) => setField('confirmPassword', v)} secure placeholder="Re-enter your password" />
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: values.termsAccepted }} onPress={() => setField('termsAccepted', !values.termsAccepted)} style={{ paddingVertical: 12 }}>
          <Text style={{ color: colors.ink }}>{values.termsAccepted ? '[x]' : '[ ]'} I have read and agree to the</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setShowTerms(true)}><Text style={{ color: colors.teal, fontWeight: '700' }}>Terms and Conditions</Text></Pressable>
      </View>
      <Message text={error} />
      <Button label={busy ? 'Submitting…' : 'Submit Request'} disabled={busy} onPress={() => void submit()} />
      <Button label="Already registered? Sign In" secondary disabled={busy} onPress={() => navigation.navigate('Login')} />
    </Card>
    <Portal><Dialog visible={showTerms} onDismiss={() => setShowTerms(false)}>
      <Dialog.Title>Terms and Conditions</Dialog.Title>
      <Dialog.Content>
        <Text>The web app currently provides the following demo terms:</Text>
        <Text style={{ marginTop: 10 }}>This is a demonstration application. Account details and password hashes are saved in this browser only. There is no server-side authentication or account recovery. Do not enter real passwords or sensitive personal information.</Text>
        <Text style={{ marginTop: 10, color: colors.critical }}>These demo terms do not describe this mobile form: it sends account details to the configured backend. Production terms have not been provided.</Text>
      </Dialog.Content>
      <Dialog.Actions><Button label="Close" secondary onPress={() => setShowTerms(false)} /></Dialog.Actions>
    </Dialog></Portal>
  </Page>;
}

export function PendingApprovalScreen({ navigation }: Props<'PendingApproval'>) {
  const { colors } = useTheme();
  return <Page auth><Brand /><Card><Title centered>Request submitted</Title>
    <Text style={{ color: colors.ink, lineHeight: 21 }}>Your account is awaiting administrator approval. You can sign in after your request is approved.</Text>
    <Button label="Back to Sign In" secondary onPress={() => navigation.popTo('Login')} />
  </Card></Page>;
}

export function ForgotPasswordScreen({ navigation }: Props<'ForgotPassword'>) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  async function submit() {
    setError('');
    setSent(false);
    setBusy(true);
    try {
      await requestPasswordReset(API_BASE_URL, API_KEY, email);
      setSent(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to send password reset.');
    } finally {
      setBusy(false);
    }
  }
  return <Page auth><Brand /><Card><Title centered detail="Enter your email address and we'll help you get back in.">Reset your password</Title>
    <AuthField label="Email" value={email} onChange={setEmail} keyboard="email-address" placeholder="Enter your email" />
    <Message text={error} />
    {sent && <Text style={{ color: colors.teal }}>Password reset instructions have been sent.</Text>}
    <Button label={busy ? 'Sending…' : 'Send Reset Link'} disabled={busy} onPress={() => void submit()} />
    <Button label="Back to Sign In" secondary disabled={busy} onPress={() => navigation.popTo('Login')} />
  </Card></Page>;
}
