import type { CSSProperties, PropsWithChildren } from 'react';
import { ASSETS } from '../../config/assets';

export default function BackgroundLayout({ children }: PropsWithChildren) {
  return (
    <main
      className="auth-background"
      style={
        { '--auth-background-image': `url("${ASSETS.background}")` } as CSSProperties
      }
    >
      {children}
    </main>
  );
}
