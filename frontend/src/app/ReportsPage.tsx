import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadReport, getLowRotationReport, getLoyaltyReport, getSalesReport, getStockMovementsReport, getStockPositionReport, getStockValidityReport, getSupplierEntriesReport, listCustomers, listProducts, listUsers } from '@/lib/api';

type ReportTab = 'position' | 'movements' | 'validity' | 'rotation' | 'suppliers' | 'sales' | 'loyalty';

const tabs: Array<{ id: ReportTab; label: string }> = [
  { id: 'position', label: 'Posição de estoque' },
  { id: 'movements', label: 'Movimentações' },
  { id: 'validity', label: 'Validade e lotes' },
  { id: 'rotation', label: 'Baixa rotatividade' },
  { id: 'suppliers', label: 'Entradas e fornecedores' },
  { id: 'sales', label: 'Vendas' },
  { id: 'loyalty', label: 'Fidelidade' },
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
  const [operatorId, setOperatorId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [saleStatus, setSaleStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [salesPage, setSalesPage] = useState(1);
  const params = { from, to };
  const position = useQuery({ queryKey: ['reports', 'position'], queryFn: getStockPositionReport, enabled: tab === 'position' });
  const movements = useQuery({ queryKey: ['reports', 'movements', params], queryFn: () => getStockMovementsReport(params), enabled: tab === 'movements' });
  const validity = useQuery({ queryKey: ['reports', 'validity'], queryFn: getStockValidityReport, enabled: tab === 'validity' });
  const rotation = useQuery({ queryKey: ['reports', 'rotation', params], queryFn: () => getLowRotationReport(params), enabled: tab === 'rotation' });
  const suppliers = useQuery({ queryKey: ['reports', 'suppliers', params], queryFn: () => getSupplierEntriesReport(params), enabled: tab === 'suppliers' });
  const sales = useQuery({
    queryKey: ['reports', 'sales', params, operatorId, paymentMethod, customerId, saleStatus, productId, salesPage],
    queryFn: () => getSalesReport({ ...params, operatorId: operatorId || undefined, paymentMethod: paymentMethod || undefined, customerId: customerId || undefined, status: saleStatus || undefined, productId: productId || undefined, page: salesPage, pageSize: 20 }),
    enabled: tab === 'sales',
  });
  const loyalty = useQuery({ queryKey: ['reports', 'loyalty', params], queryFn: () => getLoyaltyReport(params), enabled: tab === 'loyalty' });
  const users = useQuery({ queryKey: ['reports', 'filters', 'users'], queryFn: () => listUsers({ page: 1, pageSize: 100 }), enabled: tab === 'sales' });
  const customers = useQuery({ queryKey: ['reports', 'filters', 'customers'], queryFn: () => listCustomers({ page: 1, pageSize: 100 }), enabled: tab === 'sales' });
  const products = useQuery({ queryKey: ['reports', 'filters', 'products'], queryFn: () => listProducts({ page: 1, pageSize: 100 }), enabled: tab === 'sales' });
  const activeQuery = { position, movements, validity, rotation, suppliers, sales, loyalty }[tab];
  const exportReport = async () => {
    const paths: Record<ReportTab, string> = { position: '/reports/stock/position', movements: '/reports/stock/movements', validity: '/reports/stock/validity', rotation: '/reports/stock/low-rotation', suppliers: '/reports/entries/suppliers', sales: '/reports/sales', loyalty: '/reports/loyalty' };
    const exportParams = tab === 'sales'
      ? { ...params, operatorId: operatorId || undefined, paymentMethod: paymentMethod || undefined, customerId: customerId || undefined, status: saleStatus || undefined, productId: productId || undefined }
      : tab === 'position' || tab === 'validity' ? {} : params;
    const blob = await downloadReport(paths[tab], exportParams);
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
      {tab === 'sales' && <>
        <label className="text-sm font-medium">Operador<select value={operatorId} onChange={(event) => { setOperatorId(event.target.value); setSalesPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option>{users.data?.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label className="text-sm font-medium">Forma de pagamento<select value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setSalesPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todas</option><option value="CASH">Dinheiro</option><option value="PIX">Pix</option><option value="DEBIT">Débito</option><option value="CREDIT">Crédito</option><option value="OTHER">Outro</option><option value="LOYALTY">Fidelidade</option></select></label>
        <label className="text-sm font-medium">Cliente<select value={customerId} onChange={(event) => { setCustomerId(event.target.value); setSalesPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option>{customers.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <label className="text-sm font-medium">Status<select value={saleStatus} onChange={(event) => { setSaleStatus(event.target.value); setSalesPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="CONFIRMADA">Confirmada</option><option value="PARCIALMENTE_DEVOLVIDA">Parcialmente devolvida</option><option value="DEVOLVIDA">Devolvida</option><option value="CANCELADA">Cancelada</option><option value="EM_ANDAMENTO">Em andamento</option></select></label>
        <label className="text-sm font-medium">Produto<select value={productId} onChange={(event) => { setProductId(event.target.value); setSalesPage(1); }} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option>{products.data?.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
      </>}
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
    {tab === 'sales' && sales.data && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">{[
        ['Bruto', `R$ ${sales.data.totals.gross.toFixed(2)}`],
        ['Líquido', `R$ ${sales.data.totals.liquid.toFixed(2)}`],
        ['Ticket médio', `R$ ${sales.data.totals.averageTicket.toFixed(2)}`],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Relatório de vendas</caption><thead><tr><th className="px-4 py-3">Confirmada em</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Bruto</th><th className="px-4 py-3">Líquido</th></tr></thead><tbody>{sales.data.sales.map((item) => <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.confirmedAt ? new Date(item.confirmedAt).toLocaleString('pt-BR') : 'Não confirmada'}</td><td className="px-4 py-3">{item.customer ?? 'Sem cliente'}</td><td className="px-4 py-3">{item.operator}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">R$ {item.gross.toFixed(2)}</td><td className="px-4 py-3">R$ {item.liquid.toFixed(2)}</td></tr>)}</tbody></table></div>
      {sales.data.totalPages > 1 && <div className="flex items-center justify-between text-sm"><button type="button" disabled={salesPage <= 1} onClick={() => setSalesPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {salesPage} de {sales.data.totalPages}</span><button type="button" disabled={salesPage >= sales.data.totalPages} onClick={() => setSalesPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div>}
    </div>}
    {tab === 'loyalty' && loyalty.data && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">{[
        ['Cadastrados', loyalty.data.totals.customersRegistered],
        ['Ativos', loyalty.data.totals.customersActive],
        ['Concedidos', loyalty.data.totals.granted],
        ['Resgatados', loyalty.data.totals.redeemed],
        ['Expirados', loyalty.data.totals.expired],
        ['Saldo', loyalty.data.totals.balanceInCirculation],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
      <div className="grid gap-5 lg:grid-cols-2"><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="px-4 pt-3 text-left font-semibold">Ranking por pontos concedidos</caption><thead><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Pontos</th></tr></thead><tbody>{loyalty.data.ranking.map((item) => <tr key={item.customerId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.customer}</td><td className="px-4 py-3">{item.points}</td></tr>)}</tbody></table></div><div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="px-4 pt-3 text-left font-semibold">Clientes com saldo negativo</caption><thead><tr><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Saldo</th></tr></thead><tbody>{loyalty.data.negativeBalances.map((item) => <tr key={item.customerId} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3">{item.customer}</td><td className="px-4 py-3">{item.balance}</td></tr>)}</tbody></table></div></div>
    </div>}
  </section>;
}
