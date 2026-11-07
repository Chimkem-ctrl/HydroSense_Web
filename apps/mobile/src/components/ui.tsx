import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  ink: '#153238',
  muted: '#64777b',
  surface: '#ffffff',
  canvas: '#f3f7f6',
  border: '#dce7e5',
  teal: '#087c78',
  warning: '#9a6400',
  critical: '#b52832',
  offline: '#fff3d4',
};

export function Page({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>{children}</ScrollView></SafeAreaView>;
}

export function Title({ children, detail }: { children: string; detail?: string }) {
  return <View style={styles.heading}><Text style={styles.title}>{children}</Text>{detail ? <Text style={styles.muted}>{detail}</Text> : null}</View>;
}

export function Card({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  return <View style={styles.card}>{(title || action) && <View style={styles.cardHeading}>{title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}{action}</View>}{children}</View>;
}

export function Button({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}><Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text></Pressable>;
}

export function StateMessage({ message, loading }: { message: string; loading?: boolean }) {
  return <View style={styles.state}>{loading ? <ActivityIndicator color={colors.teal} /> : null}<Text style={styles.muted}>{message}</Text></View>;
}

export function DataRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <View style={styles.dataRow}><View><Text style={styles.dataLabel}>{label}</Text>{detail ? <Text style={styles.muted}>{detail}</Text> : null}</View><Text style={styles.dataValue}>{value}</Text></View>;
}

export const ui = StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  label: { color: colors.ink, fontWeight: '700', marginBottom: 6 },
  formField: { gap: 6, marginBottom: 12 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  page: { padding: 16, paddingBottom: 30, gap: 14 },
  heading: { gap: 4, paddingVertical: 2 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  button: { minHeight: 46, borderRadius: 10, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 15 },
  secondaryButton: { backgroundColor: '#e8f4f2', borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.teal },
  disabled: { opacity: 0.5 },
  state: { padding: 18, alignItems: 'center', gap: 10 },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, gap: 8 },
  dataLabel: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  dataValue: { color: colors.ink, fontWeight: '800', fontSize: 17 },
});
