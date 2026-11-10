import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth/RoleContext';

interface TankSelection {
  tankId: string;
  setTankId: (tankId: string) => void;
}

const TankContext = createContext<TankSelection | null>(null);

export function TankProvider({ children }: { children: ReactNode }) {
  const user = useAuth();
  const { data: tanks = [] } = useQuery({
    queryKey: ['tanks'],
    queryFn: () => api.listTanks(),
    enabled: Boolean(user?.role),
  });
  const [selectedId, setSelectedId] = useState('');
  const tankId = tanks.some((tank) => tank.id === selectedId) ? selectedId : tanks[0]?.id ?? '';
  return <TankContext.Provider value={{ tankId, setTankId: setSelectedId }}>{children}</TankContext.Provider>;
}

export function useSelectedTank() {
  const value = useContext(TankContext);
  if (!value) throw new Error('useSelectedTank must be used within TankProvider.');
  return value;
}
