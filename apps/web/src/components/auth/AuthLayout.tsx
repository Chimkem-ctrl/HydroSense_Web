import type { PropsWithChildren } from 'react';
import BackgroundLayout from '../common/BackgroundLayout';

export default function AuthLayout({ children }: PropsWithChildren) {
  return (
    <BackgroundLayout>
      <div className="auth-content">{children}</div>
    </BackgroundLayout>
  );
}
