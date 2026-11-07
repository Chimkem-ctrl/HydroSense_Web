import type { PropsWithChildren } from 'react';

export default function AuthFooter({ children }: PropsWithChildren) {
  return <div className="auth-footer">{children}</div>;
}
