import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';
import { ProtectedLayout } from '@/app/ProtectedLayout';
import { LoginPage } from '@/app/LoginPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedLayout />,
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
