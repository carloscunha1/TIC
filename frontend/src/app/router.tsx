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
import { CreateProductPage } from '@/app/CreateProductPage';
import { ProductsPage } from '@/app/ProductsPage';
import { EditProductPage } from '@/app/EditProductPage';
import { EntriesPage } from '@/app/EntriesPage';
import { EntryDraftPage } from '@/app/EntryDraftPage';
import { StockPage } from '@/app/StockPage';
import { InventoriesPage } from '@/app/InventoriesPage';

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
        path: '/produtos',
        element: <ProductsPage />,
      },
      {
        path: '/produtos/novo',
        element: <CreateProductPage />,
      },
      {
        path: '/produtos/:id/editar',
        element: <EditProductPage />,
      },
      { path: '/entradas', element: <EntriesPage /> },
      { path: '/entradas/nova', element: <EntryDraftPage /> },
      { path: '/entradas/:id/editar', element: <EntryDraftPage /> },
      { path: '/estoque', element: <StockPage /> },
      { path: '/inventarios', element: <InventoriesPage /> },
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
