import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';
import { AppShell } from '@/app/AppShell';
import { LoginPage } from '@/app/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AppShell />,
    children: [
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
