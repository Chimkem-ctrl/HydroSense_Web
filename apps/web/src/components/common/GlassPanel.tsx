import type { PropsWithChildren } from 'react';

interface GlassPanelProps extends PropsWithChildren {
  className?: string;
  width?: number | string;
}

export default function GlassPanel({
  children,
  className = '',
  width,
}: GlassPanelProps) {
  return (
    <section
      className={`glass-panel ${className}`.trim()}
      style={width ? { width } : undefined}
    >
      {children}
    </section>
  );
}
