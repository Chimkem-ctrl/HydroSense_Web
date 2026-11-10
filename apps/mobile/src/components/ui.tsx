import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import type { Palette } from '../theme';

export function Page({ children, auth = false }: PropsWithChildren<{ auth?: boolean }>) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <LinearGradient colors={[colors.canvas, colors.backgroundVia, colors.backgroundTo]} style={styles.background}>
    <SafeAreaView style={styles.safe} edges={auth ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, auth && styles.authScroll]}>
        <View style={[styles.page, { paddingHorizontal: width >= 600 ? 32 : 16 }, auth && styles.authPage]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  </LinearGradient>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={compact ? styles.brandCompact : styles.brand}>
    <Image source={require('../../assets/hydrosense-logo.png')} resizeMode="contain" accessibilityLabel="HydroSense logo" style={compact ? styles.logoSmall : styles.logo} />
    <View style={compact ? styles.brandTextCompact : styles.brandText}>
      <Text numberOfLines={compact ? 1 : undefined} style={compact ? styles.brandNameSmall : styles.brandName}>HydroSense</Text>
      <Text numberOfLines={compact ? 1 : undefined} style={styles.brandCaption}>WATER QUALITY MONITORING</Text>
    </View>
  </View>;
}

export function Title({ children, detail, centered = false }: { children: string; detail?: string; centered?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={[styles.heading, centered && styles.centered]}><Text style={[styles.title, centered && styles.centerText]}>{children}</Text>{detail ? <Text style={[styles.muted, centered && styles.centerText]}>{detail}</Text> : null}</View>;
}

export function Card({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={styles.card}>{(title || action) && <View style={styles.cardHeading}>{title ? <Text style={styles.cardTitle}>{title}</Text> : <View />}{action}</View>}{children}</View>;
}

export function Button({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, disabled && styles.disabled, pressed && styles.pressed]}>
    {secondary ? <Text style={styles.secondaryText}>{label}</Text> :
      <LinearGradient colors={['#1d4ed8', '#0369a1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}><Text style={styles.buttonText}>{label}</Text></LinearGradient>}
  </Pressable>;
}

export function StateMessage({ message, loading }: { message: string; loading?: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={styles.state}>{loading ? <ActivityIndicator color={colors.teal} /> : null}<Text style={[styles.muted, styles.centerText]}>{message}</Text></View>;
}

export function DataRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={styles.dataRow}><View style={{ flex: 1 }}><Text style={styles.dataLabel}>{label}</Text>{detail ? <Text style={styles.muted}>{detail}</Text> : null}</View><Text style={styles.dataValue}>{value}</Text></View>;
}

export const createFormStyles = (colors: Palette) => StyleSheet.create({
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 48, backgroundColor: colors.surface, color: colors.ink, fontSize: 16 },
  label: { color: colors.ink, fontWeight: '700', marginBottom: 4, fontSize: 14 },
  formField: { gap: 6, marginBottom: 8 },
});

const createStyles = (colors: Palette) => StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  authScroll: { justifyContent: 'center' },
  page: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingTop: 24, paddingBottom: 36, gap: 18 },
  authPage: { maxWidth: 620, paddingTop: 32, paddingBottom: 40 },
  brand: { alignItems: 'center', gap: 10, marginBottom: 8 },
  brandCompact: { flexDirection: 'row', alignItems: 'center', gap: 9, minWidth: 0 },
  brandTextCompact: { flexShrink: 1, minWidth: 0 },
  brandText: { alignItems: 'center', gap: 3 },
  logo: { width: 52, height: 74 },
  logoSmall: { width: 26, height: 37, flexShrink: 0 },
  brandName: { color: colors.ink, fontWeight: '800', fontSize: 24, letterSpacing: -0.5 },
  brandNameSmall: { color: colors.ink, fontWeight: '800', fontSize: 17 },
  brandCaption: { color: colors.muted, fontSize: 9, letterSpacing: 0.9, fontWeight: '700' },
  heading: { gap: 6, paddingVertical: 2 },
  centered: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  title: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.cardBorder, padding: 20, gap: 14, shadowColor: '#1e40af', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', flexShrink: 1 },
  button: { minHeight: 48, borderRadius: 24, overflow: 'hidden', justifyContent: 'center' },
  buttonGradient: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  state: { padding: 18, alignItems: 'center', gap: 10 },
  dataRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, gap: 8 },
  dataLabel: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  dataValue: { color: colors.ink, fontWeight: '700', fontSize: 17, flexShrink: 1, textAlign: 'right' },
});
