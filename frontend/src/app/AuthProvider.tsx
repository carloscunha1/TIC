import { useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { getCurrentSession } from '@/lib/api';
import { AuthContext, type AuthContextValue } from '@/app/auth-context';

export function AuthProvider({ children }: PropsWithChildren) {
  const query = useQuery({
    queryFn: getCurrentSession,
    queryKey: ['current-session'],
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const value: AuthContextValue = {
    hasPermission: (permission) => !query.isFetching && (query.data?.permissions.includes(permission) ?? false),
    isLoading: query.isLoading || query.isFetching,
    session: query.isFetching ? undefined : query.data ?? undefined,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
