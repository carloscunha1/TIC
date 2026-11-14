import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';
import { ProtectedLayout } from '@/app/ProtectedLayout';
import { CreateUserPage } from '@/app/CreateUserPage';
import { EditUserPage } from '@/app/EditUserPage';
import { LoginPage } from '@/app/LoginPage';
import { UsersPage } from '@/app/UsersPage';
import { ResetPasswordPage } from '@/app/ResetPasswordPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/redefinir-senha',
    element: <ResetPasswordPage />,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: '/usuarios',
        element: <UsersPage />,
      },
      {
        path: '/usuarios/:id/editar',
        element: <EditUserPage />,
      },
      {
        path: '/usuarios/novo',
        element: <CreateUserPage />,
      },
      {
        path: '/',
        element: <FoundationPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
