import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { createCustomStockLossReason, getStockBalances, listCustomStockLossReasons, listProductLotsForLoss, listProducts, listStockLossReasons, recordStockAdjustment, recordStockExit, recordStockLoss, updateCustomStockLossReason, type ProductListItem, type StockAdjustmentInput, type StockExitInput, type StockLossInput } from '@/lib/api';
import { useAuth } from '@/app/auth-context';

const quantitySchema = z.number().finite().positive('Informe uma quantidade maior que zero.').max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.');
const adjustmentSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto.'),
  direction: z.enum(['POSITIVE', 'NEGATIVE']),
  quantity: quantitySchema,
  justification: z.string().trim().min(1, 'A justificativa é obrigatória.').max(300, 'A justificativa deve ter até 300 caracteres.'),
});
const exitSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto.'),
  quantity: quantitySchema,
  reason: z.string().trim().min(1, 'O motivo é obrigatório.').max(300, 'O motivo deve ter até 300 caracteres.'),
});
const lossSchema = z.object({
  productId: z.string().min(1, 'Selecione um produto.'),
  reasonId: z.string().min(1, 'Selecione um motivo.'),
  quantity: quantitySchema,
  lotId: z.string().optional(),
  observations: z.string().trim().max(500, 'A observação deve ter até 500 caracteres.'),
});
type AdjustmentForm = z.infer<typeof adjustmentSchema>;
type ExitForm = z.infer<typeof exitSchema>;
type LossForm = z.infer<typeof lossSchema>;

function quantity(value: string): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function dateLabel(value: string | null): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem validade';
}

export function StockPage() {
  const { hasPermission } = useAuth();
  const canManageReasons = hasPermission('settings.manage');
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const products = useQuery({ queryKey: ['products', 'stock-operations', productSearch], queryFn: () => listProducts({ page: 1, pageSize: 100, search: productSearch || undefined }) });
  const balances = useQuery({ queryKey: ['stock-balances', page], queryFn: () => getStockBalances({ page, pageSize: 20 }) });
  const lossReasons = useQuery({ queryKey: ['stock-loss-reasons'], queryFn: listStockLossReasons });
  const customReasons = useQuery({ queryKey: ['stock-loss-reasons', 'custom'], queryFn: listCustomStockLossReasons, enabled: canManageReasons });
  const adjustmentForm = useForm<AdjustmentForm>({ resolver: zodResolver(adjustmentSchema), defaultValues: { productId: '', direction: 'POSITIVE', quantity: 1, justification: '' } });
  const exitForm = useForm<ExitForm>({ resolver: zodResolver(exitSchema), defaultValues: { productId: '', quantity: 1, reason: '' } });
  const lossForm = useForm<LossForm>({ resolver: zodResolver(lossSchema), defaultValues: { productId: '', reasonId: '', quantity: 1, lotId: '', observations: '' } });
  const adjustmentProduct = products.data?.products.find((product: ProductListItem) => product.id === adjustmentForm.watch('productId'));
  const exitProduct = products.data?.products.find((product: ProductListItem) => product.id === exitForm.watch('productId'));
  const lossProduct = products.data?.products.find((product: ProductListItem) => product.id === lossForm.watch('productId'));
  const lossLots = useQuery({ queryKey: ['stock-loss-lots', lossProduct?.id], queryFn: () => listProductLotsForLoss(lossProduct!.id), enabled: lossProduct?.stockMode === 'LOTE' });
  const lossProductLots = lossLots.data ?? [];
  const adjustmentMutation = useMutation({
    mutationFn: (values: StockAdjustmentInput) => recordStockAdjustment(values),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['stock-balances'] })]); adjustmentForm.reset({ productId: adjustmentForm.getValues('productId'), direction: 'POSITIVE', quantity: 1, justification: '' }); },
  });
  const exitMutation = useMutation({
    mutationFn: (values: StockExitInput) => recordStockExit(values),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['stock-balances'] })]); exitForm.reset({ productId: exitForm.getValues('productId'), quantity: 1, reason: '' }); },
  });
  const lossMutation = useMutation({
    mutationFn: (values: StockLossInput) => recordStockLoss(values),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['stock-balances'] })]); lossForm.reset({ productId: lossForm.getValues('productId'), reasonId: lossForm.getValues('reasonId'), quantity: 1, lotId: '', observations: '' }); },
  });
  const createReasonMutation = useMutation({ mutationFn: createCustomStockLossReason, onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['stock-loss-reasons'] }), client.invalidateQueries({ queryKey: ['stock-loss-reasons', 'custom'] })]); } });
  const updateReasonMutation = useMutation({ mutationFn: ({ id, ...payload }: { id: string; name?: string; isActive?: boolean }) => updateCustomStockLossReason(id, payload), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['stock-loss-reasons'] }), client.invalidateQueries({ queryKey: ['stock-loss-reasons', 'custom'] })]); } });

  useEffect(() => {
    if (adjustmentProduct?.unit === 'UN' && !Number.isInteger(adjustmentForm.getValues('quantity'))) adjustmentForm.setValue('quantity', Math.floor(adjustmentForm.getValues('quantity')) || 1, { shouldValidate: true });
  }, [adjustmentProduct, adjustmentForm]);
  useEffect(() => {
    if (exitProduct?.unit === 'UN' && !Number.isInteger(exitForm.getValues('quantity'))) exitForm.setValue('quantity', Math.floor(exitForm.getValues('quantity')) || 1, { shouldValidate: true });
  }, [exitProduct, exitForm]);

  const submitAdjustment = adjustmentForm.handleSubmit((values) => adjustmentMutation.mutate({ ...values, quantity: Number(values.quantity) }));
  const submitExit = exitForm.handleSubmit((values) => exitMutation.mutate({ ...values, quantity: Number(values.quantity) }));
  const submitLoss = lossForm.handleSubmit((values) => lossMutation.mutate({ productId: values.productId, reasonId: values.reasonId, quantity: Number(values.quantity), ...(values.lotId ? { lotId: values.lotId } : {}), ...(values.observations ? { observations: values.observations } : {}) }));

  return <section aria-labelledby="stock-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="stock-title" className="mt-1 text-2xl font-bold">Estoque</h1><p className="mt-2 text-sm text-slate-500">Consulte saldos físicos e disponíveis, registre ajustes, saídas e perdas.</p></div>

    <section aria-labelledby="stock-balances-title" className="mb-8">
      <h2 id="stock-balances-title" className="mb-3 text-lg font-semibold">Saldos por produto e lote</h2>
      {balances.isLoading && <p role="status" className="py-6 text-center text-sm text-slate-500">Carregando saldos…</p>}
      {balances.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{balances.error.message}</p>}
      {balances.data?.products.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto cadastrado.</p>}
      {balances.data && balances.data.products.length > 0 && <><div className="overflow-x-auto rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Saldos físicos e disponíveis do estoque</caption><thead><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Modalidade</th><th className="px-4 py-3">Saldo físico</th><th className="px-4 py-3">Saldo disponível</th></tr></thead><tbody>{balances.data.products.map((product) => <tr key={product.id} className="border-t align-top dark:border-slate-800"><td className="px-4 py-3 font-medium">{product.name}<span className="block text-xs text-slate-500">{product.sku}</span>{product.stockMode === 'LOTE' && product.lots.length > 0 && <ul className="mt-2 space-y-1 font-normal">{product.lots.map((lot) => <li key={lot.id} className="text-xs text-slate-600 dark:text-slate-300">Lote {lot.identifier} · {quantity(lot.currentQuantity)} {product.unit} · validade {dateLabel(lot.expirationDate)} · {Number(lot.currentQuantity) === 0 ? 'Sem saldo' : lot.available ? 'Disponível' : 'Vencido'}</li>)}</ul>}</td><td className="px-4 py-3">{product.stockMode === 'SIMPLES' ? 'Simples' : 'Lote'}</td><td className="px-4 py-3">{quantity(product.physicalBalance)} {product.unit}</td><td className="px-4 py-3">{quantity(product.availableBalance)} {product.unit}</td></tr>)}</tbody></table></div><div className="mt-3 flex items-center justify-between text-sm"><span>{balances.data.total} produto(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.max(balances.data.totalPages, 1)}</span><button type="button" disabled={page >= balances.data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div></>}
    </section>

    <div className="mb-6 max-w-xl"><label htmlFor="stock-product-search" className="text-sm font-medium">Filtrar produtos dos formulários<input id="stock-product-search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nome, SKU ou código de barras" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label></div>
    {products.isLoading && <p role="status" className="mb-4 text-sm text-slate-500">Carregando produtos…</p>}
    {products.isError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{products.error.message}</p>}

    <div className="grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="stock-adjustment-title" className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 id="stock-adjustment-title" className="text-lg font-semibold">Ajuste de estoque simples</h2><p className="mb-4 mt-1 text-sm text-slate-500">Ajuste não substitui o registro de perda.</p>
        {adjustmentMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{adjustmentMutation.error.message}</p>}
        {adjustmentMutation.isSuccess && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Ajuste registrado. Novo saldo: {quantity(adjustmentMutation.data.balance)}.</p>}
        <form className="space-y-4" onSubmit={submitAdjustment} noValidate>
          <label className="block text-sm font-medium" htmlFor="adjustment-product">Produto simples *<select id="adjustment-product" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" disabled={products.isLoading || products.isError} {...adjustmentForm.register('productId')}><option value="">Selecione um produto</option>{products.data?.products.filter((product) => product.stockMode === 'SIMPLES').map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stockBalance ?? '—'} {product.unit}</option>)}</select></label>
          {adjustmentForm.formState.errors.productId && <p role="alert" className="-mt-3 text-xs text-red-700">{adjustmentForm.formState.errors.productId.message}</p>}
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium" htmlFor="adjustment-direction">Tipo<select id="adjustment-direction" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...adjustmentForm.register('direction')}><option value="POSITIVE">Positivo</option><option value="NEGATIVE">Negativo</option></select></label><label className="text-sm font-medium" htmlFor="adjustment-quantity">Quantidade do ajuste *<input id="adjustment-quantity" type="number" min={adjustmentProduct?.unit === 'UN' ? 1 : 0.001} step={adjustmentProduct?.unit === 'UN' ? 1 : 0.001} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...adjustmentForm.register('quantity', { valueAsNumber: true })} />{adjustmentForm.formState.errors.quantity && <span role="alert" className="mt-1 block text-xs text-red-700">{adjustmentForm.formState.errors.quantity.message}</span>}</label></div>
          <label className="block text-sm font-medium" htmlFor="adjustment-justification">Justificativa *<textarea id="adjustment-justification" rows={2} maxLength={300} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...adjustmentForm.register('justification')} /></label>
          {adjustmentForm.formState.errors.justification && <p role="alert" className="-mt-3 text-xs text-red-700">{adjustmentForm.formState.errors.justification.message}</p>}
          <button type="submit" disabled={adjustmentMutation.isPending || products.isLoading || products.isError || !products.data?.products.some((product) => product.stockMode === 'SIMPLES')} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{adjustmentMutation.isPending ? 'Registrando…' : 'Registrar ajuste'}</button>
        </form>
      </section>

      <section aria-labelledby="stock-exit-title" className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 id="stock-exit-title" className="text-lg font-semibold">Saída comum</h2><p className="mb-4 mt-1 text-sm text-slate-500">Em produtos por lote, o sistema seleciona automaticamente FEFO e usa FIFO em caso de empate. Lotes vencidos não entram na seleção.</p>
        {exitMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{exitMutation.error.message}</p>}
        {exitMutation.isSuccess && <div role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"><p>Saída registrada. Saldo disponível restante: {quantity(exitMutation.data.availableBalance)}.</p>{exitMutation.data.movements.some((movement) => movement.lotIdentifier) && <ul className="mt-1">{exitMutation.data.movements.filter((movement) => movement.lotIdentifier).map((movement) => <li key={movement.id}>Lote {movement.lotIdentifier}: {quantity(movement.quantity)}</li>)}</ul>}</div>}
        <form className="space-y-4" onSubmit={submitExit} noValidate>
          <label className="block text-sm font-medium" htmlFor="exit-product">Produto ativo *<select id="exit-product" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" disabled={products.isLoading || products.isError} {...exitForm.register('productId')}><option value="">Selecione um produto</option>{products.data?.products.filter((product) => product.status === 'ACTIVE').map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stockMode === 'LOTE' ? 'por lote' : 'simples'}</option>)}</select></label>
          {exitForm.formState.errors.productId && <p role="alert" className="-mt-3 text-xs text-red-700">{exitForm.formState.errors.productId.message}</p>}
          <label className="block text-sm font-medium" htmlFor="exit-quantity">Quantidade de saída *<input id="exit-quantity" type="number" min={exitProduct?.unit === 'UN' ? 1 : 0.001} step={exitProduct?.unit === 'UN' ? 1 : 0.001} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...exitForm.register('quantity', { valueAsNumber: true })} />{exitForm.formState.errors.quantity && <span role="alert" className="mt-1 block text-xs text-red-700">{exitForm.formState.errors.quantity.message}</span>}</label>
          <label className="block text-sm font-medium" htmlFor="exit-reason">Motivo da saída *<textarea id="exit-reason" rows={2} maxLength={300} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...exitForm.register('reason')} /></label>
          {exitForm.formState.errors.reason && <p role="alert" className="-mt-3 text-xs text-red-700">{exitForm.formState.errors.reason.message}</p>}
          <button type="submit" disabled={exitMutation.isPending || products.isLoading || products.isError || !products.data?.products.some((product) => product.status === 'ACTIVE')} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{exitMutation.isPending ? 'Registrando…' : 'Registrar saída'}</button>
        </form>
      </section>
    </div>

    <section aria-labelledby="stock-loss-title" className="mt-6 max-w-2xl rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 id="stock-loss-title" className="text-lg font-semibold">Registrar perda</h2><p className="mb-4 mt-1 text-sm text-slate-500">A baixa fica registrada como perda, separada de ajustes. Para produtos por lote, selecione o lote; lotes vencidos também podem ser baixados.</p>
      {lossMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{lossMutation.error.message}</p>}
      {lossMutation.isSuccess && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Perda registrada. Movimento: {lossMutation.data.movement.id}.</p>}
      {lossReasons.isError && <p role="alert" className="mb-3 text-sm text-red-700">{lossReasons.error.message}</p>}
      <form className="space-y-4" onSubmit={submitLoss} noValidate>
        <label htmlFor="loss-product" className="block text-sm font-medium">Produto *<select id="loss-product" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...lossForm.register('productId', { onChange: () => lossForm.setValue('lotId', '') })}><option value="">Selecione um produto</option>{products.data?.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.stockMode === 'LOTE' ? 'por lote' : 'simples'} · {product.status === 'ACTIVE' ? 'ativo' : 'inativo'}</option>)}</select></label>
        {lossForm.formState.errors.productId && <p role="alert" className="-mt-3 text-xs text-red-700">{lossForm.formState.errors.productId.message}</p>}
        {lossProduct?.stockMode === 'LOTE' && <label htmlFor="loss-lot" className="block text-sm font-medium">Lote *<select id="loss-lot" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...lossForm.register('lotId')}><option value="">Selecione um lote</option>{lossProductLots.map((lot) => <option key={lot.id} value={lot.id}>Lote {lot.identifier} · {quantity(lot.currentQuantity)} {lossProduct.unit} · validade {dateLabel(lot.expirationDate)}{lot.available ? '' : ' · vencido'}</option>)}</select>{lossLots.isError && <span role="alert" className="mt-1 block text-xs text-red-700">{lossLots.error.message}</span>}</label>}
        <div className="grid gap-4 sm:grid-cols-2"><label htmlFor="loss-reason" className="text-sm font-medium">Motivo *<select id="loss-reason" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...lossForm.register('reasonId')}><option value="">Selecione um motivo</option>{lossReasons.data?.map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}</select>{lossForm.formState.errors.reasonId && <span role="alert" className="mt-1 block text-xs text-red-700">{lossForm.formState.errors.reasonId.message}</span>}</label><label htmlFor="loss-quantity" className="text-sm font-medium">Quantidade *<input id="loss-quantity" type="number" min={lossProduct?.unit === 'UN' ? 1 : 0.001} step={lossProduct?.unit === 'UN' ? 1 : 0.001} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...lossForm.register('quantity', { valueAsNumber: true })} />{lossForm.formState.errors.quantity && <span role="alert" className="mt-1 block text-xs text-red-700">{lossForm.formState.errors.quantity.message}</span>}</label></div>
        <label htmlFor="loss-observations" className="block text-sm font-medium">Observações (quando necessário)<textarea id="loss-observations" rows={2} maxLength={500} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...lossForm.register('observations')} /></label>
        <button type="submit" disabled={lossMutation.isPending || lossReasons.isLoading || lossLots.isLoading || !products.data?.products.length || (lossProduct?.stockMode === 'LOTE' && lossProductLots.length === 0)} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{lossMutation.isPending ? 'Registrando…' : 'Registrar perda'}</button>
      </form>
    </section>

    {canManageReasons && <section aria-labelledby="loss-reasons-admin-title" className="mt-6 max-w-2xl rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 id="loss-reasons-admin-title" className="text-lg font-semibold">Motivos customizados</h2><form className="my-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const input = new FormData(form).get('reasonName'); if (typeof input === 'string' && input.trim()) createReasonMutation.mutate(input.trim(), { onSuccess: () => form.reset() }); }}><label className="sr-only" htmlFor="custom-loss-reason-name">Novo motivo</label><input id="custom-loss-reason-name" name="reasonName" minLength={2} maxLength={120} required placeholder="Nome do motivo" className="min-w-0 flex-1 rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950"/><button type="submit" disabled={createReasonMutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Adicionar</button></form>{(createReasonMutation.isError || updateReasonMutation.isError) && <p role="alert" className="mb-3 text-sm text-red-700">{(createReasonMutation.error ?? updateReasonMutation.error)?.message}</p>}{customReasons.data?.length === 0 && <p className="text-sm text-slate-500">Nenhum motivo customizado cadastrado.</p>}<ul className="space-y-2">{customReasons.data?.map((reason) => <li key={reason.id} className="flex items-center justify-between gap-3 border-t pt-2 text-sm"><span>{reason.name} · {reason.isActive ? 'Ativo' : 'Inativo'}</span><div className="flex gap-3"><button type="button" className="font-semibold text-[#0045B5]" onClick={() => { const name = window.prompt('Novo nome do motivo', reason.name); if (name?.trim() && name.trim() !== reason.name) updateReasonMutation.mutate({ id: reason.id, name: name.trim() }); }}>Editar</button><button type="button" disabled={updateReasonMutation.isPending} className="font-semibold text-slate-600 disabled:opacity-50" onClick={() => updateReasonMutation.mutate({ id: reason.id, isActive: !reason.isActive })}>{reason.isActive ? 'Inativar' : 'Reativar'}</button></div></li>)}</ul></section>}
    <div className="mt-6"><Link to="/produtos" className="text-sm font-semibold text-[#0045B5]">Voltar aos produtos</Link></div>
  </section>;
}
