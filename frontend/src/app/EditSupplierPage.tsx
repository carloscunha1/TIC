import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getSupplier, updateSupplier } from '@/lib/api';
import { digits, maskCpf, maskCnpj, maskPhone } from '@/lib/masks';

const schema = z.object({ name: z.string().min(2, 'Informe o nome do fornecedor.'), document: z.string().optional(), phone: z.string().max(30).optional(), email: z.string().email('Informe um e-mail válido.').or(z.literal('')).optional(), notes: z.string().max(500).optional() });
type Form = z.infer<typeof schema>;

export function EditSupplierPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['supplier', id], queryFn: () => getSupplier(id), enabled: Boolean(id) });
  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const mutation = useMutation({ mutationFn: (values: Form) => updateSupplier(id, {
    ...values,
    document: values.document ? digits(values.document) : undefined,
    phone: values.phone ? digits(values.phone) : undefined,
  }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['suppliers'] }); navigate('/fornecedores', { replace: true }); } });
  if (query.isLoading) return <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando fornecedor…</p>;
  if (query.isError || !query.data) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error?.message ?? 'Fornecedor não encontrado.'}</p>;
  const maskedDocument = query.data.document
    ? (query.data.document.replace(/\D/g, '').length <= 11 ? maskCpf(query.data.document) : maskCnpj(query.data.document))
    : '';
  return <section className="mx-auto max-w-2xl" aria-labelledby="edit-supplier-title"><Link to="/fornecedores" className="text-sm font-semibold text-[#0045B5]">← Voltar para fornecedores</Link><h1 id="edit-supplier-title" className="mt-3 text-2xl font-bold">Editar fornecedor</h1><form className="mt-6 space-y-5 rounded-xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate><div><label htmlFor="edit-supplier-name" className="mb-1.5 block text-sm font-medium">Nome *</label><input id="edit-supplier-name" defaultValue={query.data.name} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>}</div><div><label htmlFor="edit-supplier-document" className="mb-1.5 block text-sm font-medium">CPF/CNPJ</label><input id="edit-supplier-document" inputMode="numeric" maxLength={18} defaultValue={maskedDocument} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('document', { onChange: (event) => { const numbers = event.target.value.replace(/\D/g, ''); event.target.value = numbers.length <= 11 ? maskCpf(numbers) : maskCnpj(numbers); } })} /></div><div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="edit-supplier-phone" className="mb-1.5 block text-sm font-medium">Telefone</label><input id="edit-supplier-phone" inputMode="tel" maxLength={15} defaultValue={maskPhone(query.data.phone ?? '')} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('phone', { onChange: (event) => { event.target.value = maskPhone(event.target.value); } })} /></div><div><label htmlFor="edit-supplier-email" className="mb-1.5 block text-sm font-medium">E-mail</label><input id="edit-supplier-email" type="email" defaultValue={query.data.email ?? ''} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('email')} />{form.formState.errors.email && <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>}</div></div><div><label htmlFor="edit-supplier-notes" className="mb-1.5 block text-sm font-medium">Observações</label><textarea id="edit-supplier-notes" rows={4} defaultValue={query.data.notes ?? ''} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('notes')} /></div>{mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p>}<button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Salvar alterações'}</button></form></section>;
}
