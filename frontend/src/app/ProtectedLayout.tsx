import { Navigate } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';
import { useAuth } from '@/app/auth-context';
import { LoadingState } from '@/components/ui/states';

export function ProtectedLayout() {
  const { isLoading, session } = useAuth();
  if (isLoading) return <LoadingState title="Verificando sessão" />;
  if (!session) return <Navigate to="/login" replace />;
  return <AppShell />;
}
