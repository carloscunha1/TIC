import {
  Bell,
  Boxes,
  ChartNoAxesCombined,
  Home,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/app/auth-context';
import { ThemeProvider } from '@/app/ThemeProvider';
import { useTheme } from '@/app/theme-context';

const navigation = [
  { label: 'Dashboard', icon: Home, permission: 'dashboard.view', to: '/' },
  { label: 'Produtos', icon: Package, permission: 'products.read', to: '/produtos' },
  { label: 'Estoque', icon: Boxes, permission: 'stock.manage', to: '/estoque' },
  { label: 'Vendas', icon: ShoppingCart, permission: 'sales.manage', to: '/vendas' },
  { label: 'Clientes', icon: Users, permission: 'customers.manage', to: '/clientes' },
  { label: 'Relatórios', icon: ChartNoAxesCombined, permission: 'reports.read', to: '/relatorios' },
  { label: 'Usuários', icon: Users, permission: 'users.manage', to: '/usuarios/novo' },
  { label: 'Configurações', icon: Settings, permission: 'settings.manage', to: '/configuracoes' },
];

function ShellContent() {
  const { theme, toggleTheme } = useTheme();
  const { hasPermission } = useAuth();
  const visibleNavigation = navigation.filter((item) => hasPermission(item.permission));
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#0045B5] text-white shadow-xl lg:flex">
        <div className="flex h-20 items-center gap-3 border-b border-white/15 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFD100] font-black text-[#0045B5]">T</div>
          <div>
            <p className="font-bold tracking-tight">TIC</p>
            <p className="text-xs text-blue-100">Sistema de Gestão</p>
          </div>
        </div>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-6">
          {visibleNavigation.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-[#0045B5] shadow-sm' : 'text-blue-50 hover:bg-white/15'
                }`
              }
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/15 p-4 text-xs text-blue-100">Posto Paulo VI · Franca/SP</div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:ml-64">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-semibold lg:hidden">TIC</span>
            <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">Painel administrativo</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Notificações">
              <Bell size={19} />
            </button>
            <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}>
              {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-[#FFD100] text-sm font-bold text-[#0045B5] sm:flex" aria-label="Usuário atual">A</div>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100vh-4rem)] pb-20 lg:ml-64 lg:pb-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>

      <nav aria-label="Navegação móvel" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        {visibleNavigation.slice(0, 5).map(({ label, icon: Icon, to }) => (
          <NavLink key={label} to={to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-md py-1 text-[11px] ${isActive ? 'font-semibold text-[#0045B5] dark:text-[#FFD100]' : 'text-slate-500'}`}>
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppShell() {
  return <ThemeProvider><ShellContent /></ThemeProvider>;
}
