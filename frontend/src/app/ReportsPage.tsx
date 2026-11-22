import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadReport, getLowRotationReport, getStockMovementsReport, getStockPositionReport, getStockValidityReport, getSupplierEntriesReport } from '@/lib/api';

type ReportTab = 'position' | 'movements' | 'validity' | 'rotation' | 'suppliers';

const tabs: Array<{ id: ReportTab; label: string }> = [
  { id: 'position', label: 'Posição de estoque' },
  { id: 'movements', label: 'Movimentações' },
  { id: 'validity', label: 'Validade e lotes' },
  { id: 'rotation', label: 'Baixa rotatividade' },
  { id: 'suppliers', label: 'Entradas e fornecedores' },
];

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('position');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const params = { from, to };
  const position = useQuery({ queryKey: ['reports', 'position'], queryFn: getStockPositionReport, enabled: tab === 'position' });
  const movements = useQuery({ queryKey: ['reports', 'movements', params], queryFn: () => getStockMovementsReport(params), enabled: tab === 'movements' });
  const validity = useQuery({ queryKey: ['reports', 'validity'], queryFn: getStockValidityReport, enabled: tab === 'validity' });
  const rotation = useQuery({ queryKey: ['reports', 'rotation', params], queryFn: () => getLowRotationReport(params), enabled: tab === 'rotation' });
  const suppliers = useQuery({ queryKey: ['reports', 'suppliers', params], queryFn: () => getSupplierEntriesReport(params), enabled: tab === 'suppliers' });
  const activeQuery = { position, movements, validity, rotation, suppliers }[tab];
  const exportReport = async () => {
    const paths: Record<ReportTab, string> = { position: '/reports/stock/position', movements: '/reports/stock/movements', validity: '/reports/stock/validity', rotation: '/reports/stock/low-rotation', suppliers: '/reports/entries/suppliers' };
    const blob = await downloadReport(paths[tab], tab === 'position' || tab === 'validity' ? {} : params);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${tab}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section aria-labelledby="reports-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Análise</p><h1 id="reports-title" className="mt-1 text-2xl font-bold">Relatórios</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Consulte os dados operacionais e exporte os resultados em CSV.</p></div>
      <button type="button" onClick={() => void exportReport()} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white">Exportar CSV</button>
    </div>
    <div className="mb-5 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2">
      <label className="text-sm font-medium">De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <label className="text-sm font-medium">Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
    </div>
    <div role="tablist" aria-label="Relatórios de estoque e fornecedores" className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === item.id ? 'border-[#0045B5] text-[#0045B5] dark:border-[#FFD100] dark:text-[#FFD100]' : 'border-transparent text-slate-500'}`}>{item.label}</button>)}
    </div>
    {activeQuery.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando relatório…</p>}
    {activeQuery.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{activeQuery.error.message}</p>}
    {tab === 'position' && position.data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Posição de estoque</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Físico</th><th className="px-4 py-3">Disponível</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Valor</th></tr></thead><tbody>{position.data.map((item) => <tr key={item.productId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.physical} {item.unit}</td><td className="px-4 py-3">{item.available} {item.unit}</td><td className="px-4 py-3">{item.minimum}</td><td className="px-4 py-3">R$ {item.estimatedValue.toFixed(2)}</td></tr>)}</tbody></table></div>}
    {tab === 'movements' && movements.data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Movimentações</caption><thead><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Responsável</th></tr></thead><tbody>{movements.data.movements.map((item) => <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{new Date(item.date).toLocaleString('pt-BR')}</td><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.type}</td><td className="px-4 py-3">{item.quantity} {item.unit}</td><td className="px-4 py-3">{item.actor}</td></tr>)}</tbody></table></div>}
    {tab === 'validity' && validity.data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Validade dos lotes</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Lote</th><th className="px-4 py-3">Validade</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{validity.data.map((item) => <tr key={item.lotId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.lot}</td><td className="px-4 py-3">{item.expirationDate ? new Date(`${item.expirationDate.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem validade'}</td><td className="px-4 py-3">{item.currentQuantity} {item.unit}</td><td className="px-4 py-3">{item.status}</td></tr>)}</tbody></table></div>}
    {tab === 'rotation' && rotation.data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Baixa rotatividade</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Quantidade vendida</th><th className="px-4 py-3">Período</th></tr></thead><tbody>{rotation.data.map((item) => <tr key={item.productId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.product}</td><td className="px-4 py-3">{item.sku}</td><td className="px-4 py-3">{item.soldQuantity}</td><td className="px-4 py-3">{item.period.from} a {item.period.to}</td></tr>)}</tbody></table></div>}
    {tab === 'suppliers' && suppliers.data && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Entradas por fornecedor</caption><thead><tr><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Entradas</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Custo total</th></tr></thead><tbody>{suppliers.data.suppliers.map((item) => <tr key={item.supplier} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.supplier}</td><td className="px-4 py-3">{item.entries}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">R$ {item.totalCost.toFixed(2)}</td></tr>)}</tbody></table></div>}
  </section>;
}
