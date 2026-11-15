import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getCategory, updateCategory } from '@/lib/api';

const schema = z.object({ name: z.string().min(2, 'Informe um nome válido.'), description: z.string().max(500, 'A descrição deve ter no máximo 500 caracteres.') });
type Form = z.infer<typeof schema>;

export function EditCategoryPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['category', id], queryFn: () => getCategory(id), enabled: Boolean(id) });
  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const mutation = useMutation({ mutationFn: (values: Form) => updateCategory(id, values), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['categories'] }); navigate('/categorias', { replace: true }); } });
  if (query.isLoading) return <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando categoria…</p>;
  if (query.isError || !query.data) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error?.message ?? 'Categoria não encontrada.'}</p>;
  return <section className="mx-auto max-w-2xl" aria-labelledby="edit-category-title"><Link to="/categorias" className="text-sm font-semibold text-[#0045B5]">← Voltar para categorias</Link><h1 id="edit-category-title" className="mt-3 text-2xl font-bold">Editar categoria</h1><form className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate><div><label htmlFor="edit-category-name" className="mb-1.5 block text-sm font-medium">Nome</label><input id="edit-category-name" defaultValue={query.data.name} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.name.message}</p>}</div><div><label htmlFor="edit-category-description" className="mb-1.5 block text-sm font-medium">Descrição</label><textarea id="edit-category-description" rows={4} defaultValue={query.data.description ?? ''} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('description')} />{form.formState.errors.description && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.description.message}</p>}</div>{mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p>}<button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Salvar alterações'}</button></form></section>;
}
