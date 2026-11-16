import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import type { FormEventHandler, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/app/auth-context';
import { awardLoyaltyPoints, getLoyaltyBalance, redeemLoyaltyPoints, reverseLoyaltyAward, reverseLoyaltyRedemption } from '@/lib/api';

const customerSchema = z.object({ customerId: z.string().uuid('Informe um UUID de cliente válido.') });
const awardSchema = customerSchema.extend({ sourceType: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Use letras maiúsculas e sublinhado.'), sourceId: z.string().min(1, 'Informe a origem.'), eligibleAmount: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Informe um valor com até duas casas decimais.') });
const redeemSchema = customerSchema.extend({ sourceType: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Use letras maiúsculas e sublinhado.'), sourceId: z.string().min(1, 'Informe a origem.'), points: z.coerce.number().int().min(1, 'Informe pelo menos 1 ponto.') });
const reversalSchema = customerSchema.extend({ sourceType: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Use letras maiúsculas e sublinhado.'), sourceId: z.string().min(1, 'Informe a origem.'), targetId: z.string().uuid('Informe um UUID válido.'), points: z.coerce.number().int().min(1).optional() });
type CustomerValues = z.infer<typeof customerSchema>;
type AwardValues = z.infer<typeof awardSchema>;
type RedeemValues = z.infer<typeof redeemSchema>;
type ReversalValues = z.infer<typeof reversalSchema>;

function FieldError({ message }: { message?: string }) { return message ? <span className="mt-1 block text-sm text-red-700">{message}</span> : null; }
function Result({ children }: { children: string }) { return <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{children}</p>; }

export function LoyaltyOperationsPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission('loyalty.read');
  const canManage = hasPermission('sales.manage');
  const customerForm = useForm<CustomerValues>({ resolver: zodResolver(customerSchema) });
  const customerId = customerForm.watch('customerId');
  const balance = useQuery({ queryKey: ['loyalty-balance', customerId], queryFn: () => getLoyaltyBalance(customerId), enabled: canRead && !!customerId && customerSchema.safeParse({ customerId }).success, retry: false });
  const award = useMutation({ mutationFn: awardLoyaltyPoints });
  const redeem = useMutation({ mutationFn: redeemLoyaltyPoints });
  const awardReversal = useMutation({ mutationFn: reverseLoyaltyAward });
  const redemptionReversal = useMutation({ mutationFn: reverseLoyaltyRedemption });
  const awardForm = useForm<AwardValues>({ resolver: zodResolver(awardSchema), defaultValues: { sourceType: 'SALE_AWARD' } });
  const redeemForm = useForm<RedeemValues>({ resolver: zodResolver(redeemSchema), defaultValues: { sourceType: 'SALE_REDEMPTION' } });
  const awardReversalForm = useForm<ReversalValues>({ resolver: zodResolver(reversalSchema), defaultValues: { sourceType: 'LOYALTY_AWARD_REVERSAL' } });
  const redemptionReversalForm = useForm<ReversalValues>({ resolver: zodResolver(reversalSchema), defaultValues: { sourceType: 'LOYALTY_REDEMPTION_REVERSAL' } });

  if (!canRead) return <Navigate to="/" replace />;
  const sharedCustomer = (formCustomerId: string) => formCustomerId || customerId;
  return <section aria-labelledby="loyalty-operations-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Fidelidade</p><h1 id="loyalty-operations-title" className="mt-1 text-2xl font-bold">Operações de pontos</h1><p className="mt-2 text-sm text-slate-500">Consulte o saldo e registre créditos, resgates e movimentos compensatórios com rastreabilidade.</p></div>
    <form className="mb-6 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900" onSubmit={customerForm.handleSubmit(() => balance.refetch())}>
      <label className="block max-w-xl text-sm font-medium">UUID do cliente<input {...customerForm.register('customerId')} placeholder="00000000-0000-0000-0000-000000000000" className="mt-1.5 block w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /> <FieldError message={customerForm.formState.errors.customerId?.message} /></label>
      <button type="submit" className="mt-3 rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white">Consultar saldo</button>
      {balance.isLoading && <p role="status" className="mt-3 text-sm text-slate-500">Consultando saldo…</p>}
      {balance.isError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{balance.error.message}</p>}
      {balance.data && <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-slate-600">Pontos disponíveis</p><p className="mt-1 text-2xl font-bold text-[#0045B5]">{balance.data.availablePoints}</p></div><div className="rounded-lg bg-orange-50 p-4"><p className="text-sm text-slate-600">Dívida de pontos</p><p className="mt-1 text-2xl font-bold text-[#FF6900]">{balance.data.debtPoints}</p></div></div>}
    </form>
    {canManage && <div className="grid gap-6 xl:grid-cols-2">
      <OperationCard title="Conceder pontos" onSubmit={awardForm.handleSubmit((values) => award.mutate({ ...values, customerId: sharedCustomer(values.customerId) }))} mutation={award} submitLabel="Conceder pontos">
        <InputField label="UUID do cliente" register={awardForm.register('customerId')} error={awardForm.formState.errors.customerId?.message} />
        <InputField label="Origem" register={awardForm.register('sourceType')} error={awardForm.formState.errors.sourceType?.message} />
        <InputField label="ID da origem" register={awardForm.register('sourceId')} error={awardForm.formState.errors.sourceId?.message} />
        <InputField label="Valor efetivamente pago" register={awardForm.register('eligibleAmount')} error={awardForm.formState.errors.eligibleAmount?.message} />
      </OperationCard>
      <OperationCard title="Resgatar pontos" onSubmit={redeemForm.handleSubmit((values) => redeem.mutate({ ...values, customerId: sharedCustomer(values.customerId) }))} mutation={redeem} submitLabel="Resgatar pontos">
        <InputField label="UUID do cliente" register={redeemForm.register('customerId')} error={redeemForm.formState.errors.customerId?.message} />
        <InputField label="Origem" register={redeemForm.register('sourceType')} error={redeemForm.formState.errors.sourceType?.message} />
        <InputField label="ID da origem" register={redeemForm.register('sourceId')} error={redeemForm.formState.errors.sourceId?.message} />
        <InputField label="Quantidade de pontos" type="number" register={redeemForm.register('points')} error={redeemForm.formState.errors.points?.message} />
      </OperationCard>
      <OperationCard title="Estornar concessão" onSubmit={awardReversalForm.handleSubmit((values) => awardReversal.mutate({ customerId: sharedCustomer(values.customerId), sourceType: values.sourceType, sourceId: values.sourceId, creditId: values.targetId, points: values.points }))} mutation={awardReversal} submitLabel="Estornar concessão">
        <InputField label="UUID do cliente" register={awardReversalForm.register('customerId')} error={awardReversalForm.formState.errors.customerId?.message} />
        <InputField label="Origem do estorno" register={awardReversalForm.register('sourceType')} error={awardReversalForm.formState.errors.sourceType?.message} />
        <InputField label="ID do estorno" register={awardReversalForm.register('sourceId')} error={awardReversalForm.formState.errors.sourceId?.message} />
        <InputField label="UUID do crédito" register={awardReversalForm.register('targetId')} error={awardReversalForm.formState.errors.targetId?.message} />
        <InputField label="Pontos (opcional)" type="number" register={awardReversalForm.register('points')} error={awardReversalForm.formState.errors.points?.message} />
      </OperationCard>
      <OperationCard title="Estornar resgate" onSubmit={redemptionReversalForm.handleSubmit((values) => redemptionReversal.mutate({ customerId: sharedCustomer(values.customerId), sourceType: values.sourceType, sourceId: values.sourceId, movementId: values.targetId, points: values.points }))} mutation={redemptionReversal} submitLabel="Estornar resgate">
        <InputField label="UUID do cliente" register={redemptionReversalForm.register('customerId')} error={redemptionReversalForm.formState.errors.customerId?.message} />
        <InputField label="Origem do estorno" register={redemptionReversalForm.register('sourceType')} error={redemptionReversalForm.formState.errors.sourceType?.message} />
        <InputField label="ID do estorno" register={redemptionReversalForm.register('sourceId')} error={redemptionReversalForm.formState.errors.sourceId?.message} />
        <InputField label="UUID do movimento de resgate" register={redemptionReversalForm.register('targetId')} error={redemptionReversalForm.formState.errors.targetId?.message} />
        <InputField label="Pontos (opcional)" type="number" register={redemptionReversalForm.register('points')} error={redemptionReversalForm.formState.errors.points?.message} />
      </OperationCard>
    </div>}
  </section>;
}

function InputField({ label, register, error, type = 'text' }: { label: string; register: UseFormRegisterReturn; error?: string; type?: string }) {
  return <label className="block text-sm font-medium">{label}<input type={type} {...register} className="mt-1.5 block w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /><FieldError message={error} /></label>;
}
function OperationCard({ title, children, onSubmit, mutation, submitLabel }: { title: string; children: ReactNode; onSubmit: FormEventHandler<HTMLFormElement>; mutation: { isPending: boolean; isError: boolean; error: Error | null; isSuccess: boolean; data?: { pointsGranted?: number; pointsCompensated?: number; pointsAvailable?: number; pointsRedeemed?: number; pointsReversed?: number; pointsRestored?: number; pointsDebtCreated?: number } }; submitLabel: string }) {
  return <form onSubmit={onSubmit} className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 space-y-3">{children}</div>{mutation.isError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutation.error?.message}</p>}{mutation.isSuccess && <Result>Operação registrada com sucesso.</Result>}<button type="submit" disabled={mutation.isPending} className="mt-4 rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Processando…' : submitLabel}</button></form>;
}
