import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createCategory } from '@/lib/api';

const categorySchema = z.object({ name: z.string().min(2, 'Informe um nome válido.'), description: z.string().max(500, 'A descrição deve ter no máximo 500 caracteres.') });
type CategoryForm = z.infer<typeof categorySchema>;

export function CreateCategoryPage() {
  const mutation = useMutation({ mutationFn: createCategory });
  const { formState: { errors }, handleSubmit, register, reset } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });
  return <section className="mx-auto max-w-2xl" aria-labelledby="create-category-title"><div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Cadastros</p><h1 id="create-category-title" className="mt-1 text-2xl font-bold">Nova categoria</h1><p className="mt-2 text-sm text-slate-500">Cadastre uma categoria para organizar os produtos.</p></div><form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={handleSubmit((values) => mutation.mutate(values, { onSuccess: () => reset() }))} noValidate><div><label htmlFor="category-name" className="mb-1.5 block text-sm font-medium">Nome</label><input id="category-name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...register('name')} />{errors.name && <p className="mt-1 text-sm text-red-600" role="alert">{errors.name.message}</p>}</div><div><label htmlFor="category-description" className="mb-1.5 block text-sm font-medium">Descrição</label><textarea id="category-description" rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...register('description')} />{errors.description && <p className="mt-1 text-sm text-red-600" role="alert">{errors.description.message}</p>}</div>{mutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{mutation.error.message}</p>}{mutation.isSuccess && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">Categoria criada com sucesso.</p>}<button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Criar categoria'}</button></form></section>;
}
