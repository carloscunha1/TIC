import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <FoundationPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
