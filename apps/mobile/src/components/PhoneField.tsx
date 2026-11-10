import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';
import { ChevronDown } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { PHONE_COUNTRIES } from '@hydrosense/shared';
import type { PhoneCountryCode } from '@hydrosense/shared';
import { useTheme } from '../theme';
import { Button, createFormStyles } from './ui';

interface PhoneFieldProps {
  label: string;
  value: string;
  country: PhoneCountryCode;
  onChange: (value: string) => void;
  onCountryChange: (country: PhoneCountryCode) => void;
}

export function PhoneField({ label, value, country, onChange, onCountryChange }: PhoneFieldProps) {
  const { colors } = useTheme();
  const ui = createFormStyles(colors);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = PHONE_COUNTRIES.find((item) => item.code === country);
  if (!selected) throw new Error(`Unknown phone country: ${country}`);
  const query = search.trim().toLowerCase();
  const options = PHONE_COUNTRIES.filter((item) => `${item.name} ${item.code} ${item.callingCode}`.toLowerCase().includes(query));
  return <View style={ui.formField}>
    <Text style={ui.label}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} country code: ${selected.name} ${selected.callingCode}`}
        accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => { setSearch(''); setOpen(true); }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 10, borderRightWidth: 1, borderRightColor: colors.border }}>
        <SvgXml xml={selected.flag} width={22} height={15} />
        <Text style={{ color: colors.ink, fontSize: 15 }}>{selected.callingCode}</Text>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <TextInput accessibilityLabel={label} style={[ui.input, { flex: 1, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent' }]} value={value} onChangeText={onChange}
        placeholder="National number" placeholderTextColor={colors.muted} keyboardType="phone-pad" autoComplete="tel-national" />
    </View>
    <Portal>
      <Dialog visible={open} onDismiss={() => setOpen(false)}>
        <Dialog.Title>Select country</Dialog.Title>
        <Dialog.Content>
          <TextInput accessibilityLabel={`Search ${label.toLowerCase()} countries`} style={ui.input} value={search}
            onChangeText={setSearch} placeholder="Search country or calling code" placeholderTextColor={colors.muted} autoCorrect={false} />
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300, marginTop: 8 }} accessibilityLabel={`${label} country options`}>
            {options.length === 0 && <Text style={{ color: colors.muted, padding: 12 }}>No countries found.</Text>}
            {options.map((item) => <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{ checked: item.code === country }}
              aria-checked={item.code === country} onPress={() => { onCountryChange(item.code); setOpen(false); }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: item.code === country ? colors.selected : colors.surface }}>
              <Text style={{ color: item.code === country ? colors.teal : colors.ink, fontSize: 15 }}>{item.name} ({item.callingCode})</Text>
            </Pressable>)}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions><Button label="Cancel" secondary onPress={() => setOpen(false)} /></Dialog.Actions>
      </Dialog>
    </Portal>
  </View>;
}
