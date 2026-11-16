import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getCustomer, updateCustomer } from '@/lib/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  phone: z.string().trim().min(1, 'Informe o telefone do cliente.').max(20),
});
type FormValues = z.infer<typeof schema>;

export function EditCustomerPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['customer', id], queryFn: () => getCustomer(id), enabled: Boolean(id) });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '' } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateCustomer(id, values),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['customers'] }); navigate('/clientes', { replace: true }); },
  });
  useEffect(() => { if (query.data) form.reset({ name: query.data.name, phone: query.data.phone }); }, [query.data, form]);

  return <section className="mx-auto max-w-2xl" aria-labelledby="edit-customer-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Cadastros</p><h1 id="edit-customer-title" className="mt-1 text-2xl font-bold">Editar cliente</h1><p className="mt-2 text-sm text-slate-500">Atualize o nome ou o telefone do cliente.</p></div>
    {query.isLoading && <p role="status" className="py-8 text-sm text-slate-500">Carregando cliente…</p>}
    {query.isError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}<Link className="ml-2 font-semibold underline" to="/clientes">Voltar à lista</Link></div>}
    {query.data && <form className="space-y-5 rounded-xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <div><label htmlFor="customer-edit-name" className="mb-1.5 block text-sm font-medium">Nome *</label><input id="customer-edit-name" autoComplete="name" className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>}</div>
      <div><label htmlFor="customer-edit-phone" className="mb-1.5 block text-sm font-medium">Telefone *</label><input id="customer-edit-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('phone')} />{form.formState.errors.phone && <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.phone.message}</p>}</div>
      {mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p>}
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Salvar alterações'}</button><Link to="/clientes" className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Cancelar</Link></div>
    </form>}
  </section>;
}
