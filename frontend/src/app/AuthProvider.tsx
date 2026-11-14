import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { getCurrentSession } from '@/lib/api';
import { AuthContext, type AuthContextValue } from '@/app/auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const query = useQuery({
    queryFn: getCurrentSession,
    queryKey: ['current-session'],
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const value: AuthContextValue = {
    hasPermission: (permission) => query.data?.permissions.includes(permission) ?? false,
    isLoading: query.isLoading,
    session: query.data,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
