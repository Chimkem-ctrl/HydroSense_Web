import { Modal, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import { formatManilaDateTime } from '@hydrosense/shared';
import { api } from '../services/client';
import { useSession } from '../state';
import { useTheme } from '../theme';
import { Button } from './ui';

export const CRITICAL_ACK_NOTE = 'Acknowledged from the critical alert pop-up.';

export function CriticalAlertModal() {
  const { colors } = useTheme();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['alerts', 'critical-popup'], queryFn: () => api.listAlerts(), enabled: Boolean(user), refetchInterval: 30000 });
  const critical = (query.data ?? [])
    .filter((alert) => alert.status === 'open' && alert.severity === 'critical')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const alert = critical[0];
  const mutation = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId, { note: CRITICAL_ACK_NOTE, user: user?.name ?? 'Mobile user' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['alert-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['alert-responses'] }),
      ]);
    },
  });
  if (!alert) return null;
  return <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(2, 9, 17, 0.78)' }}>
      <View accessibilityViewIsModal accessibilityRole="alert" style={{ width: '100%', maxWidth: 420, gap: 12, alignItems: 'center', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: colors.critical, backgroundColor: colors.surface }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: `${colors.critical}24` }}>
          <AlertTriangle size={30} color={colors.critical} />
        </View>
        <Text style={{ color: colors.critical, fontSize: 22, fontWeight: '800' }}>Critical alert</Text>
        <Text style={{ color: colors.ink, fontSize: 16, textAlign: 'center', lineHeight: 24 }}>{alert.parameter} is at {alert.value} in {alert.tankId}. Threshold: {alert.threshold}.</Text>
        <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>Raised {formatManilaDateTime(alert.createdAt)} PHT{critical.length > 1 ? ` · ${critical.length - 1} more critical ${critical.length - 1 === 1 ? 'alert' : 'alerts'} waiting` : ''}</Text>
        {mutation.isError && <Text accessibilityRole="alert" style={{ color: colors.critical }}>{mutation.error.message}</Text>}
        <View style={{ alignSelf: 'stretch', marginTop: 4 }}>
          <Button label={mutation.isPending ? 'Acknowledging…' : 'Acknowledge'} disabled={mutation.isPending} onPress={() => mutation.mutate(alert.id)} />
        </View>
      </View>
    </View>
  </Modal>;
}
