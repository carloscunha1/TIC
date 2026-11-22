import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDashboardReport } from '@/lib/api';
import { useAuth } from '@/app/auth-context';

type Preset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'MONTH' | 'PREVIOUS_MONTH' | 'YEAR' | 'CUSTOM';

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function periodFor(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (date: Date) => localDate(date);
  if (preset === 'YESTERDAY') {
    const date = new Date(today); date.setDate(date.getDate() - 1);
    return { from: at(date), to: at(date) };
  }
  if (preset === 'LAST_7') {
    const date = new Date(today); date.setDate(date.getDate() - 6);
    return { from: at(date), to: at(today) };
  }
  if (preset === 'LAST_30') {
    const date = new Date(today); date.setDate(date.getDate() - 29);
    return { from: at(date), to: at(today) };
  }
  if (preset === 'MONTH') return { from: at(new Date(today.getFullYear(), today.getMonth(), 1)), to: at(today) };
  if (preset === 'PREVIOUS_MONTH') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: at(first), to: at(last) };
  }
  if (preset === 'YEAR') return { from: at(new Date(today.getFullYear(), 0, 1)), to: at(today) };
  return { from: at(today), to: at(today) };
}

const presets: Array<{ value: Preset; label: string }> = [
  { value: 'TODAY', label: 'Hoje' },
  { value: 'YESTERDAY', label: 'Ontem' },
  { value: 'LAST_7', label: 'Últimos 7 dias' },
  { value: 'LAST_30', label: 'Últimos 30 dias' },
  { value: 'MONTH', label: 'Mês atual' },
  { value: 'PREVIOUS_MONTH', label: 'Mês anterior' },
  { value: 'YEAR', label: 'Ano atual' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'blue' | 'green' | 'orange' }) {
  const tones = { slate: 'border-slate-200 dark:border-slate-800', blue: 'border-blue-200 dark:border-blue-900', green: 'border-emerald-200 dark:border-emerald-900', orange: 'border-orange-200 dark:border-orange-900' };
  return <div className={`rounded-xl border bg-white p-4 dark:bg-slate-900 ${tones[tone]}`}><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}

export function DashboardPage() {
  const { session } = useAuth();
  const [preset, setPreset] = useState<Preset>('TODAY');
  const [customFrom, setCustomFrom] = useState(() => periodFor('TODAY').from);
  const [customTo, setCustomTo] = useState(() => periodFor('TODAY').to);
  const period = useMemo(() => preset === 'CUSTOM' ? { from: customFrom, to: customTo } : periodFor(preset), [preset, customFrom, customTo]);
  const dashboard = useQuery({ queryKey: ['reports', 'dashboard', period], queryFn: () => getDashboardReport(period) });
  const isViewer = session?.role === 'VIEWER';
  const canViewFinancial = !isViewer;

  return <section aria-labelledby="dashboard-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Visão geral</p><h1 id="dashboard-title" className="mt-1 text-2xl font-bold">Dashboard</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Indicadores da operação entre {period.from} e {period.to}.</p></div>
      <select aria-label="Período do dashboard" value={preset} onChange={(event) => setPreset(event.target.value as Preset)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-950">{presets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
    </div>
    {preset === 'CUSTOM' && <div className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2"><label className="text-sm font-medium">De<input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label><label className="text-sm font-medium">Até<input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label></div>}
    {dashboard.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando dashboard…</p>}
    {dashboard.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{dashboard.error.message}</p>}
    {dashboard.data && <>
      <section aria-labelledby="stock-dashboard-title" className="mb-6">
        <h2 id="stock-dashboard-title" className="mb-3 text-lg font-semibold">Estoque atual</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Produtos cadastrados" value={dashboard.data.stock.productCount} tone="blue" />
          <MetricCard label="Quantidade física" value={dashboard.data.stock.physicalQuantity.toLocaleString('pt-BR')} />
          <MetricCard label="Quantidade disponível" value={dashboard.data.stock.availableQuantity.toLocaleString('pt-BR')} tone="green" />
          {canViewFinancial && <MetricCard label="Valor estimado" value={`R$ ${dashboard.data.stock.estimatedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} tone="orange" />}
          <MetricCard label="Abaixo do mínimo" value={dashboard.data.stock.belowMinimum} tone="orange" />
          <MetricCard label="Estoque zerado" value={dashboard.data.stock.zero} tone="orange" />
          <MetricCard label="Lotes próximos" value={dashboard.data.stock.lotsNearExpiration} />
          <MetricCard label="Lotes vencidos" value={dashboard.data.stock.expiredLots} />
        </div>
      </section>
      <section aria-labelledby="operation-dashboard-title" className="mb-6">
        <h2 id="operation-dashboard-title" className="mb-3 text-lg font-semibold">Operação no período</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Vendas confirmadas" value={dashboard.data.operation.salesCount} tone="blue" />
          {canViewFinancial && <MetricCard label="Faturamento líquido" value={`R$ ${dashboard.data.operation.liquid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} tone="green" />}
          {canViewFinancial && <MetricCard label="Ticket médio" value={`R$ ${dashboard.data.operation.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />}
          <MetricCard label="Entradas confirmadas" value={dashboard.data.operation.entriesCount} />
          <MetricCard label="Saídas de estoque" value={dashboard.data.operation.stockOut.toLocaleString('pt-BR')} />
          <MetricCard label="Entradas de estoque" value={dashboard.data.operation.stockIn.toLocaleString('pt-BR')} tone="green" />
          {canViewFinancial && <MetricCard label="Custo das entradas" value={`R$ ${dashboard.data.operation.entriesCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />}
        </div>
      </section>
      {canViewFinancial && <section aria-labelledby="loyalty-dashboard-title" className="mb-6">
        <h2 id="loyalty-dashboard-title" className="mb-3 text-lg font-semibold">Fidelidade no período</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pontos concedidos" value={dashboard.data.loyalty.granted} tone="blue" />
          <MetricCard label="Pontos resgatados" value={dashboard.data.loyalty.redeemed} tone="orange" />
          <MetricCard label="Pontos expirados" value={dashboard.data.loyalty.expired} />
          <MetricCard label="Saldo em circulação" value={dashboard.data.loyalty.balanceInCirculation} tone="green" />
        </div>
      </section>}
      {!isViewer && <div className="grid gap-5 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="px-4 pt-3 text-left font-semibold">Produtos mais vendidos</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Quantidade líquida</th></tr></thead><tbody>{dashboard.data.operation.topProducts.map((item) => <tr key={item.productId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.quantity}</td></tr>)}</tbody></table></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="px-4 pt-3 text-left font-semibold">Produtos menos vendidos</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Quantidade líquida</th></tr></thead><tbody>{dashboard.data.operation.leastProducts.map((item) => <tr key={item.productId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.quantity}</td></tr>)}</tbody></table></div>
      </div>}
    </>}
  </section>;
}
