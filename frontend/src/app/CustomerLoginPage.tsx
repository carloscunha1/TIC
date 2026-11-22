import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getCustomerSession, getPublicCustomerLoyalty, loginCustomer, logoutCustomer } from '@/lib/api';
const schema = z.object({ phone: z.string().min(1, 'Informe o telefone.'), pin: z.string().regex(/^\d{6}$/, 'O PIN deve conter seis dígitos.') });
type FormValues = z.infer<typeof schema>;
export function CustomerLoginPage() {
  const [name, setName] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const queryClient = useQueryClient();
  const existingSession = useQuery({ queryKey: ['customer-session'], queryFn: getCustomerSession, retry: false });
  useEffect(() => {
    if (existingSession.data) { setName(existingSession.data.name); setAuthenticated(true); }
  }, [existingSession.data]);
  const loyalty = useQuery({ queryKey: ['customer-loyalty'], queryFn: getPublicCustomerLoyalty, enabled: authenticated });
  const loginMutation = useMutation({ mutationFn: (values: FormValues) => loginCustomer(values.phone, values.pin), onSuccess: async () => { const session = await getCustomerSession(); setName(session.name); setAuthenticated(true); } });
  const logoutMutation = useMutation({ mutationFn: logoutCustomer, onSuccess: () => { setAuthenticated(false); setName(''); loginMutation.reset(); void queryClient.removeQueries({ queryKey: ['customer-loyalty'] }); } });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const historyLabel = {
    CREDIT: 'Crédito',
    REDEMPTION: 'Resgate',
    EXPIRATION: 'Expiração',
    REVERSAL: 'Estorno',
    COMPENSATION: 'Compensação',
  } as const;
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
    <section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
      <h1 className="text-2xl font-bold">Minha fidelidade</h1>
      {!authenticated ? <>
        <p className="mt-2 text-sm text-slate-600">Entre com seu telefone e PIN de seis dígitos.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}>
          <label className="block text-sm font-medium">Telefone<input {...register('phone')} type="tel" autoComplete="tel" className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          {errors.phone && <p role="alert" className="text-sm text-red-700">{errors.phone.message}</p>}
          <label className="block text-sm font-medium">PIN<input {...register('pin')} type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>
          {errors.pin && <p role="alert" className="text-sm text-red-700">{errors.pin.message}</p>}
          {loginMutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Telefone ou PIN inválidos.</p>}
          <button disabled={loginMutation.isPending} className="w-full rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white disabled:opacity-60">{loginMutation.isPending ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </> : <div className="mt-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><p role="status" className="text-sm text-slate-500">Olá, {name}</p><p className="mt-2 text-sm text-slate-500">Saldo disponível</p><p className="text-4xl font-bold text-[#0045B5]">{loyalty.data?.availablePoints ?? '—'} pontos</p></div>
          <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{logoutMutation.isPending ? 'Saindo…' : 'Sair'}</button>
        </div>
        {loyalty.isLoading && <p role="status" className="py-6 text-center text-sm text-slate-500">Consultando seus pontos…</p>}
        {loyalty.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{loyalty.error.message}</p>}
        {loyalty.data && <>
          <section aria-labelledby="near-expiration-title" className="mb-6">
            <h2 id="near-expiration-title" className="mb-3 font-semibold">Créditos que vencem nos próximos 30 dias</h2>
            {loyalty.data.nearExpiration.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Nenhum crédito próximo do vencimento.</p> : <ul className="space-y-2">{loyalty.data.nearExpiration.map((credit) => <li key={credit.creditId} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm"><span>{credit.points} pontos</span><time dateTime={credit.expiresAt}>{new Date(credit.expiresAt).toLocaleDateString('pt-BR')}</time></li>)}</ul>}
          </section>
          <section aria-labelledby="loyalty-history-title">
            <h2 id="loyalty-history-title" className="mb-3 font-semibold">Histórico de pontos</h2>
            {loyalty.data.history.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Nenhum movimento encontrado.</p> : <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="min-w-full text-left text-sm"><caption className="sr-only">Histórico de créditos, resgates e expirações</caption><thead><tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Movimento</th><th className="px-3 py-2">Pontos</th></tr></thead><tbody>{loyalty.data.history.map((movement) => <tr key={movement.id} className="border-t border-slate-200"><td className="px-3 py-2">{new Date(movement.createdAt).toLocaleString('pt-BR')}</td><td className="px-3 py-2">{historyLabel[movement.type]}</td><td className="px-3 py-2">{movement.points > 0 ? '+' : ''}{movement.points}</td></tr>)}</tbody></table></div>}
          </section>
        </>}
      </div>}
    </section>
  </main>;
}
