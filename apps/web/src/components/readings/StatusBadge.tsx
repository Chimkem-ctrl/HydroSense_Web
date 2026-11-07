import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react';
import type { Level } from '@hydrosense/shared';

const icons = {
  normal: CheckCircle2,
  warning: AlertTriangle,
  critical: CircleAlert,
};

const text = {
  normal: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
};

export function StatusBadge({ level, label }: { level: Level; label?: string }) {
  const Icon = icons[level];
  return <span className={`badge level-${level}`} aria-label={`Status: ${label ?? text[level]}`}><Icon size={15} aria-hidden="true" />{label ?? text[level]}</span>;
}
