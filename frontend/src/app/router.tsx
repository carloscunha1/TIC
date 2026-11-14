import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';
import { ProtectedLayout } from '@/app/ProtectedLayout';
import { CreateUserPage } from '@/app/CreateUserPage';
import { LoginPage } from '@/app/LoginPage';
import { UsersPage } from '@/app/UsersPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: '/usuarios',
        element: <UsersPage />,
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
