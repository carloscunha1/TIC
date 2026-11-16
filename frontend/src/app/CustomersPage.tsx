import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCustomers, type CustomerListItem } from '@/lib/api';

function displayDate(value: string): string {
  return new Date(value).toLocaleDateString('pt-BR');
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerListItem['status'] | ''>('');
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ['customers', page, search, status], queryFn: () => listCustomers({ page, pageSize: 20, search: search.trim() || undefined, status: status || undefined }) });

  return <section aria-labelledby="customers-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#0045B5]">Cadastros</p><h1 id="customers-title" className="mt-1 text-2xl font-bold">Clientes</h1><p className="mt-2 text-sm text-slate-500">Pesquise clientes pelo nome ou telefone e acompanhe o status do cadastro.</p></div><Link to="/clientes/novo" className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white">Novo cliente</Link></div>
    <div className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="text-sm font-medium">Nome ou telefone<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>
      <label className="text-sm font-medium">Status<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="PENDING_PIN">Pendente de PIN</option><option value="ACTIVE">Ativo</option></select></label>
      <button type="button" onClick={() => { setSearch(''); setStatus(''); setPage(1); }} className="self-end rounded-lg border px-3 py-2 text-sm font-semibold">Limpar filtros</button>
    </div>
    {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando clientes…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
    {query.data?.customers.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Nenhum cliente encontrado.</p>}
    {query.data && query.data.customers.length > 0 && <>
      <div className="overflow-x-auto rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Clientes cadastrados</caption><thead><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Telefone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Cadastrado em</th><th className="px-4 py-3">Ações</th></tr></thead><tbody>{query.data.customers.map((customer) => <tr key={customer.id} className="border-t dark:border-slate-800"><td className="px-4 py-3 font-medium">{customer.name}</td><td className="px-4 py-3">{customer.phone}</td><td className="px-4 py-3">{customer.status === 'PENDING_PIN' ? 'Pendente de PIN' : 'Ativo'}</td><td className="px-4 py-3">{displayDate(customer.createdAt)}</td><td className="px-4 py-3"><Link to={`/clientes/${customer.id}/editar`} className="font-semibold text-[#0045B5]">Editar</Link></td></tr>)}</tbody></table></div>
      <div className="mt-4 flex items-center justify-between text-sm"><span>{query.data.total} cliente(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {query.data.page} de {Math.max(query.data.totalPages, 1)}</span><button type="button" disabled={page >= query.data.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
    </>}
  </section>;
}
