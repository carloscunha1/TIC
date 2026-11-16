import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createCustomer } from '@/lib/api';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do cliente.').max(160),
  phone: z.string().trim().min(1, 'Informe o telefone do cliente.').max(20),
  privacyNoticeAcknowledged: z.boolean().refine((acknowledged) => acknowledged, 'Confirme a ciência do aviso de privacidade.'),
});
type FormValues = z.infer<typeof schema>;

export function CustomerRegistrationForm({ mode = 'ADMIN', onCreated }: { mode?: 'ADMIN' | 'QUICK'; onCreated?: () => void }) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', privacyNoticeAcknowledged: false } });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => createCustomer(values, mode === 'QUICK'),
    onSuccess: () => {
      form.reset();
      onCreated?.();
    },
  });
  const title = mode === 'QUICK' ? 'Cadastro rápido de cliente' : 'Novo cliente';

  return <section aria-labelledby="customer-registration-title">
    {mode === 'ADMIN' && <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Cadastros</p><h1 id="customer-registration-title" className="mt-1 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm text-slate-500">Cadastre nome e telefone. O cliente poderá ativar a conta ao definir o PIN.</p></div>}
    {mode === 'QUICK' && <h2 id="customer-registration-title" className="mb-4 text-lg font-semibold">{title}</h2>}
    <form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <div><label htmlFor="customer-name" className="mb-1.5 block text-sm font-medium">Nome *</label><input id="customer-name" autoComplete="name" className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.name.message}</p>}</div>
      <div><label htmlFor="customer-phone" className="mb-1.5 block text-sm font-medium">Telefone *</label><input id="customer-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('phone')} />{form.formState.errors.phone && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.phone.message}</p>}</div>
      <div><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" {...form.register('privacyNoticeAcknowledged')} /><span>O cliente recebeu e deu ciência do aviso de privacidade.</span></label>{form.formState.errors.privacyNoticeAcknowledged && <p className="mt-1 text-sm text-red-600" role="alert">{form.formState.errors.privacyNoticeAcknowledged.message}</p>}</div>
      {mutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{mutation.error.message}</p>}
      {mutation.isSuccess && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">Cliente cadastrado e aguardando definição do PIN.</p>}
      <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : mode === 'QUICK' ? 'Cadastrar cliente' : 'Criar cliente'}</button>
    </form>
  </section>;
}
