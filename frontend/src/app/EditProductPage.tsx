import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { getProduct, getProductValueHistory, listCategories, updateProduct, type CategoryListItem } from '@/lib/api';

const schema = z.object({ name: z.string().trim().min(2, 'Informe o nome do produto.').max(160), description: z.string().max(500).optional(), barcode: z.string().max(50).optional(), categoryId: z.string().uuid('Selecione uma categoria.'), unit: z.enum(['UN', 'KG', 'G', 'L', 'ML']), cost: z.coerce.number().finite().min(0), salePrice: z.coerce.number().finite().min(0), minimumStock: z.coerce.number().finite().min(0), stockMode: z.enum(['SIMPLES', 'LOTE']), expirationAlertDays: z.coerce.number().int().min(0).max(365) });
type Form = z.infer<typeof schema>;

export function EditProductPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const product = useQuery({ queryKey: ['products', 'detail', id], queryFn: () => getProduct(id), enabled: Boolean(id) });
  const categories = useQuery({ queryKey: ['categories', 'product-edit'], queryFn: () => listCategories({ page: 1, pageSize: 100 }) });
  const history = useQuery({ queryKey: ['products', id, 'value-history'], queryFn: () => getProductValueHistory(id), enabled: Boolean(id) });
  const mutation = useMutation({ mutationFn: (values: Form) => updateProduct(id, values), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['products'] }); navigate('/produtos'); } });
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { unit: 'UN', stockMode: 'SIMPLES', minimumStock: 0, expirationAlertDays: 15 } });

  useEffect(() => {
    if (product.data) form.reset({ name: product.data.name, description: product.data.description ?? '', barcode: product.data.barcode ?? '', categoryId: product.data.categoryId, unit: product.data.unit, cost: Number(product.data.cost), salePrice: Number(product.data.salePrice), minimumStock: Number(product.data.minimumStock), stockMode: product.data.stockMode, expirationAlertDays: product.data.expirationAlertDays });
  }, [form, product.data]);

  if (product.isLoading) return <p role="status" className="py-8 text-center">Carregando produto…</p>;
  if (product.isError || !product.data) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{product.error?.message ?? 'Produto não encontrado.'}</p>;

  return <section className="mx-auto max-w-3xl" aria-labelledby="edit-product-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Cadastros</p><h1 id="edit-product-title" className="mt-1 text-2xl font-bold">Editar produto</h1><p className="mt-2 text-sm text-slate-500">SKU {product.data.sku} · altere os dados do produto.</p></div>
    <form className="grid gap-5 rounded-xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
      <div><label htmlFor="product-name" className="mb-1.5 block text-sm font-medium">Nome *</label><input id="product-name" className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('name')} />{form.formState.errors.name && <p role="alert" className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>}</div>
      <div className="grid gap-5 sm:grid-cols-2"><label htmlFor="product-category" className="text-sm font-medium">Categoria *<select id="product-category" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('categoryId')}><option value="">Selecione</option>{categories.data?.categories.map((category: CategoryListItem) => <option key={category.id} value={category.id}>{category.name}{category.status === 'INACTIVE' ? ' (inativa)' : ''}</option>)}</select></label><label htmlFor="product-barcode" className="text-sm font-medium">Código de barras<input id="product-barcode" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('barcode')} /></label></div>
      <div className="grid gap-5 sm:grid-cols-2"><label htmlFor="product-unit" className="text-sm font-medium">Unidade<select id="product-unit" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('unit')}><option value="UN">UN</option><option value="KG">KG</option><option value="G">G</option><option value="L">L</option><option value="ML">ML</option></select></label><label htmlFor="product-stock-mode" className="text-sm font-medium">Modalidade<select id="product-stock-mode" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('stockMode')}><option value="SIMPLES">Simples</option><option value="LOTE">Lote</option></select><span className="mt-1 block text-xs text-amber-700">A validação de alterações após movimentações será concluída na TIC-029.</span></label></div>
      <div className="grid gap-5 sm:grid-cols-3"><label htmlFor="product-cost" className="text-sm font-medium">Custo<input id="product-cost" type="number" step="0.01" min="0" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('cost', { valueAsNumber: true })} /></label><label htmlFor="product-sale-price" className="text-sm font-medium">Preço de venda<input id="product-sale-price" type="number" step="0.01" min="0" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('salePrice', { valueAsNumber: true })} /></label><label htmlFor="product-minimum-stock" className="text-sm font-medium">Estoque mínimo<input id="product-minimum-stock" type="number" step="0.001" min="0" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('minimumStock', { valueAsNumber: true })} /></label></div>
      <label htmlFor="product-expiration-days" className="text-sm font-medium">Antecedência de validade (dias)<input id="product-expiration-days" type="number" min="0" max="365" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('expirationAlertDays', { valueAsNumber: true })} /></label>
      <label htmlFor="product-description" className="text-sm font-medium">Descrição<textarea id="product-description" rows={3} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('description')} /></label>
      {mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutation.error.message}</p>}
      {categories.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Não foi possível carregar as categorias.</p>}
      <div className="flex gap-3"><button type="submit" disabled={mutation.isPending || categories.isLoading} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Salvar alterações'}</button><Link to="/produtos" className="rounded-lg border px-4 py-2.5 font-semibold">Cancelar</Link></div>
    </form>
    <section aria-labelledby="product-history-title" className="mt-8"><h2 id="product-history-title" className="mb-3 text-lg font-semibold">Histórico de preço e custo</h2>{history.isLoading && <p role="status">Carregando histórico…</p>}{history.isError && <p role="alert" className="text-sm text-red-700">{history.error.message}</p>}{history.data?.length === 0 && <p className="rounded-lg border border-dashed p-5 text-sm text-slate-500">Ainda não há alterações de preço ou custo.</p>}{history.data && history.data.length > 0 && <ul className="divide-y rounded-xl border bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">{history.data.map((entry) => <li key={entry.id} className="flex flex-wrap justify-between gap-2 p-4 text-sm"><div><p>{entry.field === 'SALE_PRICE' ? 'Preço de venda' : 'Custo'}: {entry.previousValue} → {entry.newValue}</p><p className="mt-1 text-xs text-slate-500">Por {entry.changedByUser?.name ?? 'usuário removido'}</p></div><time dateTime={entry.changedAt}>{new Date(entry.changedAt).toLocaleString('pt-BR')}</time></li>)}</ul>}</section>
  </section>;
}
