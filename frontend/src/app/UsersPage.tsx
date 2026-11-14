import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listUsers, type UserListItem } from '@/lib/api';

const PAGE_SIZE = 20;

const roleLabels: Record<UserListItem['role'], string> = {
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  VIEWER: 'Visualizador',
};

const statusLabels: Record<UserListItem['status'], string> = { ACTIVE: 'Ativo', INACTIVE: 'Inativo' };

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserListItem['role'] | ''>('');
  const [status, setStatus] = useState<UserListItem['status'] | ''>('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['users', page, search, role, status],
    queryFn: () => listUsers({ page, pageSize: PAGE_SIZE, search: search || undefined, role: role || undefined, status: status || undefined }),
  });

  function resetFilters(): void {
    setSearch('');
    setRole('');
    setStatus('');
    setPage(1);
  }

  return (
    <section aria-labelledby="users-title">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-[#0045B5]">Administração</p><h1 id="users-title" className="mt-1 text-2xl font-bold">Usuários</h1><p className="mt-2 text-sm text-slate-500">Consulte os acessos administrativos do sistema.</p></div>
        <Link to="/usuarios/novo" className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00398f]">Novo usuário</Link>
      </div>
      <div className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="text-sm font-medium">Busca<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nome ou e-mail" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none focus:border-[#0045B5] dark:border-slate-700 dark:bg-slate-950" /></label>
        <label className="text-sm font-medium">Perfil<select value={role} onChange={(event) => { setRole(event.target.value as typeof role); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="ADMIN">Administrador</option><option value="OPERATOR">Operador</option><option value="VIEWER">Visualizador</option></select></label>
        <label className="text-sm font-medium">Status<select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="">Todos</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></label>
        <button type="button" onClick={resetFilters} className="self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Limpar filtros</button>
      </div>
      {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando usuários…</p>}
      {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
      {query.data && query.data.users.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum usuário encontrado.</p>}
      {query.data && query.data.users.length > 0 && <>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Usuários cadastrados</caption><thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{query.data.users.map((user) => <tr key={user.id}><td className="px-4 py-3 font-medium">{user.name}</td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3">{roleLabels[user.role]}</td><td className="px-4 py-3"><span className={user.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'}>{statusLabels[user.status]}</span></td><td className="px-4 py-3"><Link to={`/usuarios/${user.id}/editar`} className="font-semibold text-[#0045B5] hover:underline">Editar</Link></td></tr>)}</tbody></table></div>
        <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">{query.data.total} usuário(s)</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700">Anterior</button><span className="px-2 py-2">Página {query.data.page} de {Math.max(query.data.totalPages, 1)}</span><button type="button" disabled={page >= query.data.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700">Próxima</button></div></div>
      </>}
    </section>
  );
}
