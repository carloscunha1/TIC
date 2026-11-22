import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/app/auth-context';
import { getEstablishmentSettings, getLoyaltyPolicy, updateEstablishmentSettings, updateLoyaltyPolicy } from '@/lib/api';
import { digits, maskCnpj, maskPhone } from '@/lib/masks';

const settingsSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome da conveniência.').max(160),
  cnpj: z.string().trim().max(18).optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
});
type SettingsForm = z.infer<typeof settingsSchema>;

const policySchema = z.object({
  pointsPerRealSpent: z.number().int().min(1, 'Informe pelo menos 1 ponto.'),
  redemptionPointsPerReal: z.number().int().min(1, 'Informe pelo menos 1 ponto.'),
});
type PolicyForm = z.infer<typeof policySchema>;

export function SettingsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ['establishment-settings'], queryFn: getEstablishmentSettings, enabled: canManage });
  const policyQuery = useQuery({ queryKey: ['loyalty-policy'], queryFn: getLoyaltyPolicy, enabled: canManage });

  const settingsForm = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { name: '', cnpj: '', phone: '', address: '' },
  });
  const policyForm = useForm<PolicyForm>({
    resolver: zodResolver(policySchema),
    defaultValues: { pointsPerRealSpent: 1, redemptionPointsPerReal: 100 },
  });

  useEffect(() => {
    if (settingsQuery.data) {
      settingsForm.reset({
        name: settingsQuery.data.name,
        cnpj: settingsQuery.data.cnpj ? maskCnpj(settingsQuery.data.cnpj) : '',
        phone: settingsQuery.data.phone ? maskPhone(settingsQuery.data.phone) : '',
        address: settingsQuery.data.address ?? '',
      });
    }
  }, [settingsQuery.data, settingsForm]);

  useEffect(() => {
    if (policyQuery.data) {
      policyForm.reset({
        pointsPerRealSpent: policyQuery.data.current.pointsPerRealSpent,
        redemptionPointsPerReal: policyQuery.data.current.redemptionPointsPerReal,
      });
    }
  }, [policyQuery.data, policyForm]);

  const settingsMutation = useMutation({
    mutationFn: (values: SettingsForm) => updateEstablishmentSettings({
      ...values,
      cnpj: digits(values.cnpj ?? ''),
      phone: digits(values.phone ?? ''),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['establishment-settings'] });
    },
  });
  const policyMutation = useMutation({
    mutationFn: (values: PolicyForm) => updateLoyaltyPolicy({
      ...values,
      expectedVersion: policyQuery.data!.current.version,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['loyalty-policy'] });
    },
  });

  if (!canManage) return <Navigate to="/" replace />;

  if (settingsQuery.isLoading || policyQuery.isLoading) {
    return <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando configurações…</p>;
  }
  if (settingsQuery.isError || policyQuery.isError) {
    return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{settingsQuery.error?.message ?? policyQuery.error?.message}</p>;
  }

  return (
    <section aria-labelledby="settings-title">
      <div className="mb-6">
        <p className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">Sistema</p>
        <h1 id="settings-title" className="mt-1 text-2xl font-bold">Configurações</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Dados da conveniência e parâmetros autorizados.</p>
      </div>

      <form
        className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={settingsForm.handleSubmit((values) => settingsMutation.mutate(values))}
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Dados da conveniência</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Informações usadas nos registros e na identificação do estabelecimento.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">
            Nome
            <input {...settingsForm.register('name')} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
            {settingsForm.formState.errors.name && <span role="alert" className="mt-1 block text-sm text-red-700">{settingsForm.formState.errors.name.message}</span>}
          </label>
          <label className="text-sm font-medium">
            CNPJ
            <input
              {...settingsForm.register('cnpj')}
              inputMode="numeric"
              maxLength={18}
              onChange={(event) => settingsForm.setValue('cnpj', maskCnpj(event.target.value), { shouldValidate: true })}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              placeholder="00.000.000/0000-00"
            />
          </label>
          <label className="text-sm font-medium">
            Telefone
            <input
              {...settingsForm.register('phone')}
              inputMode="tel"
              maxLength={15}
              onChange={(event) => settingsForm.setValue('phone', maskPhone(event.target.value), { shouldValidate: true })}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"
              placeholder="(16) 99999-9999"
            />
          </label>
          <label className="text-sm font-medium md:col-span-2">
            Endereço
            <textarea {...settingsForm.register('address')} rows={3} className="mt-1.5 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" placeholder="Rua, número, bairro, cidade/UF" />
          </label>
        </div>
        {settingsMutation.isError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{settingsMutation.error.message}</p>}
        {settingsMutation.isSuccess && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Dados da conveniência atualizados.</p>}
        <button type="submit" disabled={settingsMutation.isPending} className="mt-5 rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {settingsMutation.isPending ? 'Salvando…' : 'Salvar dados'}
        </button>
      </form>

      {policyQuery.data && (
        <form
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          onSubmit={policyForm.handleSubmit((values) => policyMutation.mutate(values))}
        >
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Fidelidade</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Versão atual · {policyQuery.data.current.version}. Nova configuração não altera créditos já concedidos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Pontos ganhos por R$ 1,00 pago
              <input type="number" min="1" step="1" {...policyForm.register('pointsPerRealSpent', { valueAsNumber: true })} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
              {policyForm.formState.errors.pointsPerRealSpent && <span role="alert" className="mt-1 block text-sm text-red-700">{policyForm.formState.errors.pointsPerRealSpent.message}</span>}
            </label>
            <label className="text-sm font-medium">
              Pontos necessários para resgatar R$ 1,00
              <input type="number" min="1" step="1" {...policyForm.register('redemptionPointsPerReal', { valueAsNumber: true })} className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
              {policyForm.formState.errors.redemptionPointsPerReal && <span role="alert" className="mt-1 block text-sm text-red-700">{policyForm.formState.errors.redemptionPointsPerReal.message}</span>}
            </label>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">A validade dos créditos é fixa em 90 dias no MVP.</p>
          {policyMutation.isError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{policyMutation.error.message}</p>}
          {policyMutation.isSuccess && <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{policyMutation.data.changed ? 'Nova versão da política criada.' : 'A política já está com esses valores.'}</p>}
          <button type="submit" disabled={policyMutation.isPending || policyQuery.isFetching} className="mt-5 rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {policyMutation.isPending ? 'Salvando…' : 'Salvar política'}
          </button>
        </form>
      )}
    </section>
  );
}
