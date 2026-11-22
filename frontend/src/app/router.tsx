import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '@/app/pages';
import { DashboardPage } from '@/app/DashboardPage';
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
import { CreateCustomerPage } from '@/app/CreateCustomerPage';
import { CustomersPage } from '@/app/CustomersPage';
import { EditCustomerPage } from '@/app/EditCustomerPage';
import { CustomerLoginPage } from '@/app/CustomerLoginPage';
import { CustomerPinSetupPage } from '@/app/CustomerPinSetupPage';
import { LoyaltyPolicyPage } from '@/app/LoyaltyPolicyPage';
import { LoyaltyOperationsPage } from '@/app/LoyaltyOperationsPage';
import { SalesPage } from '@/app/SalesPage';
import { SaleDraftPage } from '@/app/SaleDraftPage';
import { SaleReturnPage } from '@/app/SaleReturnPage';
import { AlertsPage } from '@/app/AlertsPage';
import { ReportsPage } from '@/app/ReportsPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/redefinir-senha',
    element: <ResetPasswordPage />,
  },
  { path: '/fidelidade', element: <CustomerLoginPage /> },
  { path: '/fidelidade/definir-pin', element: <CustomerPinSetupPage /> },
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
      { path: '/clientes', element: <CustomersPage /> },
      { path: '/clientes/novo', element: <CreateCustomerPage /> },
      { path: '/clientes/:id/editar', element: <EditCustomerPage /> },
      { path: '/fidelidade/politica', element: <LoyaltyPolicyPage /> },
      { path: '/fidelidade/operacoes', element: <LoyaltyOperationsPage /> },
      { path: '/vendas', element: <SalesPage /> },
      { path: '/vendas/nova', element: <SaleDraftPage /> },
      { path: '/vendas/:id/editar', element: <SaleDraftPage /> },
      { path: '/vendas/:id/devolucao', element: <SaleReturnPage /> },
      { path: '/alertas', element: <AlertsPage /> },
      { path: '/relatorios', element: <ReportsPage /> },
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
        element: <DashboardPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
