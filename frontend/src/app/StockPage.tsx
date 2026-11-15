import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { getStockBalances, listProducts, recordStockAdjustment, recordStockExit, type ProductListItem, type StockAdjustmentInput, type StockExitInput } from '@/lib/api';

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
type AdjustmentForm = z.infer<typeof adjustmentSchema>;
type ExitForm = z.infer<typeof exitSchema>;

function quantity(value: string): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function dateLabel(value: string | null): string {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem validade';
}

export function StockPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const products = useQuery({ queryKey: ['products', 'stock-operations', productSearch], queryFn: () => listProducts({ page: 1, pageSize: 100, search: productSearch || undefined }) });
  const balances = useQuery({ queryKey: ['stock-balances', page], queryFn: () => getStockBalances({ page, pageSize: 20 }) });
  const adjustmentForm = useForm<AdjustmentForm>({ resolver: zodResolver(adjustmentSchema), defaultValues: { productId: '', direction: 'POSITIVE', quantity: 1, justification: '' } });
  const exitForm = useForm<ExitForm>({ resolver: zodResolver(exitSchema), defaultValues: { productId: '', quantity: 1, reason: '' } });
  const adjustmentProduct = products.data?.products.find((product: ProductListItem) => product.id === adjustmentForm.watch('productId'));
  const exitProduct = products.data?.products.find((product: ProductListItem) => product.id === exitForm.watch('productId'));
  const adjustmentMutation = useMutation({
    mutationFn: (values: StockAdjustmentInput) => recordStockAdjustment(values),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['stock-balances'] })]); adjustmentForm.reset({ productId: adjustmentForm.getValues('productId'), direction: 'POSITIVE', quantity: 1, justification: '' }); },
  });
  const exitMutation = useMutation({
    mutationFn: (values: StockExitInput) => recordStockExit(values),
    onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['products'] }), client.invalidateQueries({ queryKey: ['stock-balances'] })]); exitForm.reset({ productId: exitForm.getValues('productId'), quantity: 1, reason: '' }); },
  });

  useEffect(() => {
    if (adjustmentProduct?.unit === 'UN' && !Number.isInteger(adjustmentForm.getValues('quantity'))) adjustmentForm.setValue('quantity', Math.floor(adjustmentForm.getValues('quantity')) || 1, { shouldValidate: true });
  }, [adjustmentProduct, adjustmentForm]);
  useEffect(() => {
    if (exitProduct?.unit === 'UN' && !Number.isInteger(exitForm.getValues('quantity'))) exitForm.setValue('quantity', Math.floor(exitForm.getValues('quantity')) || 1, { shouldValidate: true });
  }, [exitProduct, exitForm]);

  const submitAdjustment = adjustmentForm.handleSubmit((values) => adjustmentMutation.mutate({ ...values, quantity: Number(values.quantity) }));
  const submitExit = exitForm.handleSubmit((values) => exitMutation.mutate({ ...values, quantity: Number(values.quantity) }));

  return <section aria-labelledby="stock-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="stock-title" className="mt-1 text-2xl font-bold">Estoque</h1><p className="mt-2 text-sm text-slate-500">Consulte saldos físicos e disponíveis, registre ajustes simples e saídas comuns.</p></div>

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
    <div className="mt-6"><Link to="/produtos" className="text-sm font-semibold text-[#0045B5]">Voltar aos produtos</Link></div>
  </section>;
}
