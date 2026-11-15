import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { listProducts, recordStockAdjustment, type ProductListItem, type StockAdjustmentInput } from '@/lib/api';

const schema = z.object({
  productId: z.string().min(1, 'Selecione um produto.'),
  direction: z.enum(['POSITIVE', 'NEGATIVE']),
  quantity: z.number().finite().positive('Informe uma quantidade maior que zero.').max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.'),
  justification: z.string().trim().min(1, 'A justificativa é obrigatória.').max(300, 'A justificativa deve ter até 300 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

export function StockPage() {
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { productId: '', direction: 'POSITIVE', quantity: 1, justification: '' } });
  const products = useQuery({ queryKey: ['products', 'stock-adjustment'], queryFn: () => listProducts({ page: 1, pageSize: 100, stockMode: 'SIMPLES' }) });
  const selectedProduct = products.data?.products.find((product: ProductListItem) => product.id === form.watch('productId'));
  const mutation = useMutation({
    mutationFn: (values: StockAdjustmentInput) => recordStockAdjustment(values),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['products'] }); form.reset({ productId: form.getValues('productId'), direction: 'POSITIVE', quantity: 1, justification: '' }); },
  });

  useEffect(() => {
    if (!selectedProduct || selectedProduct.unit !== 'UN') return;
    const quantity = form.getValues('quantity');
    if (!Number.isInteger(quantity)) form.setValue('quantity', Math.floor(quantity) || 1, { shouldValidate: true });
  }, [selectedProduct, form]);

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate({ ...values, quantity: Number(values.quantity) });
  });

  return <section className="mx-auto max-w-3xl" aria-labelledby="stock-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="stock-title" className="mt-1 text-2xl font-bold">Ajuste de estoque</h1><p className="mt-2 text-sm text-slate-500">Corrija o saldo de um produto de estoque simples. Para registrar uma perda, use o fluxo específico de perdas.</p></div>
    {products.isLoading && <p role="status" className="mb-4">Carregando produtos…</p>}
    {products.isError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{products.error.message}</p>}
    {products.data?.products.length === 0 && <p className="mb-4 rounded-lg border border-dashed p-6 text-center text-sm text-slate-500">Nenhum produto de estoque simples encontrado.</p>}
    {mutation.isError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{mutation.error.message}</p>}
    {mutation.isSuccess && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Ajuste registrado. Novo saldo: {Number(mutation.data.balance).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}.</p>}
    <form className="space-y-5 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900" onSubmit={onSubmit} noValidate>
      <label className="block text-sm font-medium" htmlFor="adjustment-product">Produto *</label>
      <select id="adjustment-product" className="-mt-3 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" disabled={products.isLoading || products.isError} {...form.register('productId')}>
        <option value="">Selecione um produto</option>
        {products.data?.products.map((product) => <option key={product.id} value={product.id}>{product.name} · saldo {product.stockBalance ?? '—'} {product.unit}</option>)}
      </select>
      {form.formState.errors.productId && <p role="alert" className="-mt-4 text-xs text-red-700">{form.formState.errors.productId.message}</p>}
      {selectedProduct && <p className="-mt-3 text-sm text-slate-500">Saldo atual: {Number(selectedProduct.stockBalance ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {selectedProduct.unit}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium" htmlFor="adjustment-direction">Tipo de ajuste<select id="adjustment-direction" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('direction')}><option value="POSITIVE">Ajuste positivo</option><option value="NEGATIVE">Ajuste negativo</option></select></label>
        <label className="text-sm font-medium" htmlFor="adjustment-quantity">Quantidade *<input id="adjustment-quantity" type="number" min={selectedProduct?.unit === 'UN' ? 1 : 0.001} step={selectedProduct?.unit === 'UN' ? 1 : 0.001} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('quantity', { valueAsNumber: true })} />{form.formState.errors.quantity && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.quantity.message}</span>}</label>
      </div>
      <label className="block text-sm font-medium" htmlFor="adjustment-justification">Justificativa *<textarea id="adjustment-justification" rows={3} maxLength={300} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('justification')} /></label>
      {form.formState.errors.justification && <p role="alert" className="-mt-4 text-xs text-red-700">{form.formState.errors.justification.message}</p>}
      <p className="text-xs text-slate-500">A justificativa fica registrada no histórico. Ajustes negativos não podem exceder o saldo atual.</p>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={mutation.isPending || products.isLoading || products.isError || !products.data?.products.length} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Registrando…' : 'Registrar ajuste'}</button><Link to="/produtos" className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Voltar aos produtos</Link></div>
    </form>
  </section>;
}
