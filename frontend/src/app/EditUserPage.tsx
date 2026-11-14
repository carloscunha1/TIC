import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getUser, updateUser } from '@/lib/api';

const editUserSchema = z.object({
  name: z.string().min(2, 'Informe o nome completo.'),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

type EditUserForm = z.infer<typeof editUserSchema>;

export function EditUserPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ['user', id], queryFn: () => getUser(id), enabled: Boolean(id) });
  const form = useForm<EditUserForm>({ resolver: zodResolver(editUserSchema) });
  const mutation = useMutation({
    mutationFn: (values: EditUserForm) => updateUser(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate('/usuarios', { replace: true });
    },
  });

  if (userQuery.isLoading) return <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando usuário…</p>;
  if (userQuery.isError || !userQuery.data) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{userQuery.error?.message ?? 'Usuário não encontrado.'}</p>;

  const user = userQuery.data;
  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="edit-user-title">
      <div className="mb-6"><Link to="/usuarios" className="text-sm font-semibold text-[#0045B5]">← Voltar para usuários</Link><h1 id="edit-user-title" className="mt-3 text-2xl font-bold">Editar usuário</h1><p className="mt-2 text-sm text-slate-500">Atualize o nome e o perfil de acesso.</p></div>
      <form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <div><label htmlFor="edit-user-name" className="mb-1.5 block text-sm font-medium">Nome</label><input id="edit-user-name" defaultValue={user.name} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.name.message}</p>}</div>
        <div><label htmlFor="edit-user-email" className="mb-1.5 block text-sm font-medium">E-mail</label><input id="edit-user-email" value={user.email} readOnly className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950" /></div>
        <div><label htmlFor="edit-user-role" className="mb-1.5 block text-sm font-medium">Perfil</label><select id="edit-user-role" defaultValue={user.role} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] dark:border-slate-700 dark:bg-slate-950" {...form.register('role')}><option value="ADMIN">Administrador</option><option value="OPERATOR">Operador</option><option value="VIEWER">Visualizador</option></select></div>
        {mutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{mutation.error.message}</p>}
        <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white hover:bg-[#00398f] disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Salvar alterações'}</button>
      </form>
    </section>
  );
}
