import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import AppRoutes from './app/AppRoutes';
import { RoleProvider } from './app/auth/RoleContext';
import { TankProvider } from './app/tank/TankContext';
import { queryClient } from './app/query';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RoleProvider>
        <TankProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TankProvider>
      </RoleProvider>
    </QueryClientProvider>
  );
}
