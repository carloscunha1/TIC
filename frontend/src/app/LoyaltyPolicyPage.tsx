import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/app/auth-context';
import { getLoyaltyPolicy, updateLoyaltyPolicy } from '@/lib/api';

const policyFormSchema = z.object({
  pointsPerRealSpent: z.number().int().min(1, 'Informe pelo menos 1 ponto.'),
  redemptionPointsPerReal: z.number().int().min(1, 'Informe pelo menos 1 ponto.'),
});
type PolicyForm = z.infer<typeof policyFormSchema>;
function formatDate(value: string) { return new Date(value).toLocaleString('pt-BR'); }

export function LoyaltyPolicyPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('loyalty-policy.manage');
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['loyalty-policy'], queryFn: getLoyaltyPolicy, enabled: canManage });
  const mutation = useMutation({
    mutationFn: (form: PolicyForm) => updateLoyaltyPolicy({ ...form, expectedVersion: query.data!.current.version }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['loyalty-policy'] }); },
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PolicyForm>({ resolver: zodResolver(policyFormSchema), defaultValues: { pointsPerRealSpent: 1, redemptionPointsPerReal: 100 } });
  useEffect(() => { if (query.data) reset({ pointsPerRealSpent: query.data.current.pointsPerRealSpent, redemptionPointsPerReal: query.data.current.redemptionPointsPerReal }); }, [query.data, reset]);

  if (!canManage) return <Navigate to="/" replace />;
  return <section aria-labelledby="loyalty-policy-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Fidelidade</p><h1 id="loyalty-policy-title" className="mt-1 text-2xl font-bold">Política de pontos</h1><p className="mt-2 text-sm text-slate-500">Cada alteração cria uma nova versão e vale somente para operações futuras. Créditos anteriores preservam suas taxas.</p></div>
    {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando política…</p>}
    {query.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{query.error.message}</p>}
    {query.data && <>
      <div className="mb-6 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">Versão atual · {query.data.current.version}</h2><p className="mt-1 text-sm text-slate-500">Vigente desde {formatDate(query.data.current.createdAt)}.</p>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <label className="text-sm font-medium">Pontos ganhos por R$ 1,00 pago<input type="number" min="1" step="1" {...register('pointsPerRealSpent', { valueAsNumber: true })} className="mt-1.5 block w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />{errors.pointsPerRealSpent && <span role="alert" className="mt-1 block text-sm text-red-700">{errors.pointsPerRealSpent.message}</span>}</label>
          <label className="text-sm font-medium">Pontos necessários para resgatar R$ 1,00<input type="number" min="1" step="1" {...register('redemptionPointsPerReal', { valueAsNumber: true })} className="mt-1.5 block w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" />{errors.redemptionPointsPerReal && <span role="alert" className="mt-1 block text-sm text-red-700">{errors.redemptionPointsPerReal.message}</span>}</label>
          <p className="text-sm text-slate-500 sm:col-span-2">A validade dos créditos é fixa em 90 dias e não pode ser alterada no MVP.</p>
          {mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{mutation.error.message}</p>}
          {mutation.isSuccess && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800 sm:col-span-2">{mutation.data.changed ? `Política atualizada para a versão ${mutation.data.policy.version}.` : 'Os valores informados já correspondem à política vigente.'}</p>}
          <button type="submit" disabled={mutation.isPending || query.isFetching} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">{mutation.isPending ? 'Salvando…' : 'Salvar nova versão'}</button>
        </form>
      </div>
      <div className="rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><h2 className="px-4 py-3 text-lg font-semibold">Histórico</h2><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><caption className="sr-only">Histórico de versões da política de fidelidade</caption><thead><tr className="border-t"><th className="px-4 py-3">Versão</th><th className="px-4 py-3">Pontos por R$ 1,00 pago</th><th className="px-4 py-3">Pontos por R$ 1,00 resgatado</th><th className="px-4 py-3">Criada em</th><th className="px-4 py-3">Estado</th></tr></thead><tbody>{query.data.history.map((policy) => <tr key={policy.id} className="border-t"><td className="px-4 py-3">{policy.version}</td><td className="px-4 py-3">{policy.pointsPerRealSpent}</td><td className="px-4 py-3">{policy.redemptionPointsPerReal}</td><td className="px-4 py-3">{formatDate(policy.createdAt)}</td><td className="px-4 py-3">{policy.isActive ? 'Vigente' : 'Histórica'}</td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
