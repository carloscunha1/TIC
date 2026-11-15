import { createBrowserRouter } from 'react-router-dom';
import { FoundationPage, NotFoundPage } from '@/app/pages';
import { ProtectedLayout } from '@/app/ProtectedLayout';
import { CreateUserPage } from '@/app/CreateUserPage';
import { EditUserPage } from '@/app/EditUserPage';
import { LoginPage } from '@/app/LoginPage';
import { UsersPage } from '@/app/UsersPage';
import { ResetPasswordPage } from '@/app/ResetPasswordPage';
import { CreateCategoryPage } from '@/app/CreateCategoryPage';
import { CategoriesPage } from '@/app/CategoriesPage';
import { EditCategoryPage } from '@/app/EditCategoryPage';
import { CreateSupplierPage } from '@/app/CreateSupplierPage';
import { SuppliersPage } from '@/app/SuppliersPage';
import { EditSupplierPage } from '@/app/EditSupplierPage';

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
        path: '/categorias',
        element: <CategoriesPage />,
      },
      {
        path: '/fornecedores/:id/editar',
        element: <EditSupplierPage />,
      },
      {
        path: '/fornecedores',
        element: <SuppliersPage />,
      },
      {
        path: '/fornecedores/novo',
        element: <CreateSupplierPage />,
      },
      {
        path: '/categorias/:id/editar',
        element: <EditCategoryPage />,
      },
      {
        path: '/categorias/nova',
        element: <CreateCategoryPage />,
      },
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
