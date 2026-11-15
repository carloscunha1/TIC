import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { createEntry, getEntry, listProducts, listSuppliers, updateEntry, type EntryDraftInput, type ProductListItem } from '@/lib/api';

const schema = z.object({ supplierId: z.string().optional(), items: z.array(z.object({ productId: z.string().min(1, 'Selecione um produto.'), quantity: z.number().positive('Informe uma quantidade maior que zero.'), unitCost: z.number().min(0, 'O custo não pode ser negativo.'), lotIdentifier: z.string().optional(), expirationDate: z.string().optional() })).min(1) });
type FormValues = z.infer<typeof schema>;

export function EntryDraftPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { supplierId: '', items: [{ productId: '', quantity: 1, unitCost: 0, lotIdentifier: '', expirationDate: '' }] } });
  const fields = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = useWatch({ control: form.control, name: 'items' });
  const products = useQuery({ queryKey: ['products', 'active-for-entry'], queryFn: () => listProducts({ page: 1, pageSize: 100, status: 'ACTIVE' }) });
  const suppliers = useQuery({ queryKey: ['suppliers', 'active-for-entry'], queryFn: () => listSuppliers({ page: 1, pageSize: 100, status: 'ACTIVE' }) });
  const entry = useQuery({ queryKey: ['entries', id], queryFn: () => getEntry(id!), enabled: Boolean(id) });
  const mutation = useMutation({
    mutationFn: (payload: EntryDraftInput) => id ? updateEntry(id, payload) : createEntry(payload),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['entries'] }); navigate('/entradas'); },
  });

  useEffect(() => {
    if (!entry.data) return;
    if (entry.data.status !== 'EM_ANDAMENTO') return;
    form.reset({ supplierId: entry.data.supplierId ?? '', items: entry.data.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unitCost: Number(item.unitCost), lotIdentifier: item.lotIdentifier ?? '', expirationDate: item.expirationDate?.slice(0, 10) ?? '' })) });
  }, [entry.data, form]);

  const onSubmit = form.handleSubmit((values) => {
    const payload: EntryDraftInput = { supplierId: values.supplierId || null, items: values.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, ...(item.lotIdentifier ? { lotIdentifier: item.lotIdentifier } : {}), ...(item.expirationDate ? { expirationDate: item.expirationDate } : {}) })) };
    mutation.mutate(payload);
  });

  if (isEditing && entry.isLoading) return <p role="status" className="py-8 text-center">Carregando entrada…</p>;
  if (isEditing && (entry.isError || !entry.data)) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{entry.error?.message ?? 'Entrada não encontrada.'}</p>;
  if (isEditing && entry.data?.status !== 'EM_ANDAMENTO') return <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Esta entrada não está em andamento e não pode ser editada.</p>;

  return <section className="mx-auto max-w-4xl" aria-labelledby="entry-draft-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="entry-draft-title" className="mt-1 text-2xl font-bold">{isEditing ? 'Editar entrada em andamento' : 'Nova entrada'}</h1><p className="mt-2 text-sm text-slate-500">O rascunho não altera o estoque. O recebimento será efetivado em uma etapa posterior.</p></div>
    {(products.isLoading || suppliers.isLoading) && <p role="status" className="mb-4">Carregando produtos e fornecedores…</p>}
    {(products.isError || suppliers.isError) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar produtos ou fornecedores para a entrada.</p>}
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><label htmlFor="entry-supplier" className="mb-1.5 block text-sm font-medium">Fornecedor (opcional)</label><select id="entry-supplier" className="w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('supplierId')}><option value="">Sem fornecedor</option>{suppliers.data?.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
      <div className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Produtos</h2><button type="button" onClick={() => fields.append({ productId: '', quantity: 1, unitCost: 0, lotIdentifier: '', expirationDate: '' })} className="rounded-lg border px-3 py-2 text-sm font-semibold">Adicionar item</button></div>
        {fields.fields.map((field, index) => {
          const selected = products.data?.products.find((product) => product.id === watchedItems?.[index]?.productId);
          return <fieldset key={field.id} className="space-y-4 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><legend className="sr-only">Item {index + 1}</legend><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Produto *<select className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register(`items.${index}.productId`)}><option value="">Selecione</option>{products.data?.products.map((product: ProductListItem) => <option key={product.id} value={product.id}>{product.name} · {product.stockMode === 'LOTE' ? 'por lote' : 'simples'}</option>)}</select>{form.formState.errors.items?.[index]?.productId && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.items[index]?.productId?.message}</span>}</label><label className="text-sm font-medium">Quantidade *<input type="number" min="0.001" step="0.001" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register(`items.${index}.quantity`, { valueAsNumber: true })} />{form.formState.errors.items?.[index]?.quantity && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.items[index]?.quantity?.message}</span>}</label><label className="text-sm font-medium">Custo unitário (R$) *<input type="number" min="0" step="0.01" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register(`items.${index}.unitCost`, { valueAsNumber: true })} />{form.formState.errors.items?.[index]?.unitCost && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.items[index]?.unitCost?.message}</span>}</label>
            {selected?.stockMode === 'LOTE' && <><label className="text-sm font-medium">Identificação do lote *<input className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register(`items.${index}.lotIdentifier`)} /></label><label className="text-sm font-medium">Validade (quando aplicável)<input type="date" className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...form.register(`items.${index}.expirationDate`)} /></label></>}
          </div><div className="flex justify-end"><button type="button" disabled={fields.fields.length === 1} onClick={() => fields.remove(index)} className="text-sm font-semibold text-red-700 disabled:opacity-40">Remover item</button></div></fieldset>;
        })}
      </div>
      {mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{mutation.error.message}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={mutation.isPending || products.isLoading || suppliers.isLoading || products.isError || suppliers.isError} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : isEditing ? 'Salvar entrada' : 'Criar entrada'}</button><Link to="/entradas" className="rounded-lg border px-4 py-2.5 text-sm font-semibold">Voltar</Link></div>
    </form>
  </section>;
}
