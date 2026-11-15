import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createInventory, getInventory, listCategories, listInventories, listProducts, recordInventoryCount, type InventoryItemView, type ProductListItem } from '@/lib/api';

const createSchema = z.object({
  type: z.enum(['COMPLETE', 'PARTIAL']),
  productIds: z.array(z.string()),
  categoryIds: z.array(z.string()),
  observations: z.string().trim().max(500, 'As observações devem ter até 500 caracteres.'),
}).refine((value) => value.type !== 'PARTIAL' || value.productIds.length > 0 || value.categoryIds.length > 0, { message: 'Selecione produtos ou categorias para o inventário parcial.', path: ['productIds'] });
const countSchema = z.object({ countedQuantity: z.number().finite().min(0, 'A contagem não pode ser negativa.').max(999_999_999.999).refine((value) => Number(value.toFixed(3)) === value, 'Quantidade aceita até 3 casas decimais.') });
type CreateForm = z.infer<typeof createSchema>;

function displayQuantity(value: string): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function displayDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

function InventoryCountRow({ item, disabled, onSave }: { item: InventoryItemView; disabled: boolean; onSave: (countedQuantity: number) => void }) {
  const form = useForm<{ countedQuantity: number }>({ resolver: zodResolver(countSchema), defaultValues: { countedQuantity: item.countedQuantity === null ? undefined : Number(item.countedQuantity) } });
  useEffect(() => { form.reset({ countedQuantity: item.countedQuantity === null ? undefined : Number(item.countedQuantity) }); }, [item.countedQuantity, form]);
  return <tr className="border-t align-top dark:border-slate-800">
    <td className="px-3 py-3 font-medium">{item.product.name}<span className="block text-xs text-slate-500">{item.product.sku}</span>{item.lot && <span className="mt-1 block text-xs text-slate-500">Lote {item.lot.identifier} · validade {item.lot.expirationDate ? new Date(`${item.lot.expirationDate}T00:00:00`).toLocaleDateString('pt-BR') : 'sem validade'}</span>}</td>
    <td className="px-3 py-3">{displayQuantity(item.snapshotQuantity)} {item.product.unit}</td>
    <td className="px-3 py-3">{displayQuantity(item.expectedQuantity)} {item.product.unit}</td>
    <td className="px-3 py-3"><form className="flex min-w-52 gap-2" onSubmit={form.handleSubmit(({ countedQuantity }) => onSave(countedQuantity))} noValidate><div><label htmlFor={`count-${item.id}`} className="sr-only">Contagem de {item.product.name}{item.lot ? ` lote ${item.lot.identifier}` : ''}</label><input id={`count-${item.id}`} type="number" min="0" step={item.product.unit === 'UN' ? 1 : 0.001} disabled={disabled} className="w-28 rounded-lg border px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950" {...form.register('countedQuantity', { valueAsNumber: true })} />{form.formState.errors.countedQuantity && <span role="alert" className="mt-1 block text-xs text-red-700">{form.formState.errors.countedQuantity.message}</span>}</div><button type="submit" disabled={disabled} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#0045B5] disabled:opacity-50">Salvar</button></form></td>
    <td className="px-3 py-3">{item.divergence === null ? '—' : `${displayQuantity(item.divergence)} ${item.product.unit}`}</td>
  </tr>;
}

export function InventoriesPage() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const inventories = useQuery({ queryKey: ['inventories', page], queryFn: () => listInventories({ page, pageSize: 20 }) });
  const categories = useQuery({ queryKey: ['categories', 'inventory-selection'], queryFn: () => listCategories({ page: 1, pageSize: 100 }) });
  const products = useQuery({ queryKey: ['products', 'inventory-selection'], queryFn: () => listProducts({ page: 1, pageSize: 100 }) });
  const inventory = useQuery({ queryKey: ['inventory', selectedInventoryId], queryFn: () => getInventory(selectedInventoryId), enabled: Boolean(selectedInventoryId) });
  const form = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { type: 'COMPLETE', productIds: [], categoryIds: [], observations: '' } });
  const selectedType = form.watch('type');

  const createMutation = useMutation({
    mutationFn: (values: CreateForm) => createInventory({ type: values.type, ...(values.type === 'PARTIAL' ? { productIds: values.productIds, categoryIds: values.categoryIds } : {}), ...(values.observations.trim() ? { observations: values.observations.trim() } : {}) }),
    onSuccess: async (created) => { await client.invalidateQueries({ queryKey: ['inventories'] }); setSelectedInventoryId(created.id); setShowCreate(false); form.reset(); },
  });
  const countMutation = useMutation({
    mutationFn: ({ itemId, countedQuantity }: { itemId: string; countedQuantity: number }) => recordInventoryCount(selectedInventoryId, itemId, countedQuantity),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['inventory', selectedInventoryId] }); await client.invalidateQueries({ queryKey: ['inventories'] }); },
  });
  const submit = form.handleSubmit((values) => createMutation.mutate(values));

  return <section aria-labelledby="inventories-title">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="inventories-title" className="mt-1 text-2xl font-bold">Inventários</h1><p className="mt-2 text-sm text-slate-500">Registre snapshots e contagens sem interromper as movimentações do estoque.</p></div><button type="button" onClick={() => setShowCreate((visible) => !visible)} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white">{showCreate ? 'Fechar formulário' : 'Novo inventário'}</button></div>

    {showCreate && <section aria-labelledby="new-inventory-title" className="mb-6 max-w-3xl rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 id="new-inventory-title" className="text-lg font-semibold">Criar inventário</h2>{createMutation.isError && <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{createMutation.error.message}</p>}<form className="mt-4 space-y-4" onSubmit={submit} noValidate>
      <label htmlFor="inventory-type" className="block text-sm font-medium">Tipo *<select id="inventory-type" className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register('type', { onChange: () => { form.setValue('productIds', []); form.setValue('categoryIds', []); } })}><option value="COMPLETE">Completo</option><option value="PARTIAL">Parcial</option></select></label>
      {selectedType === 'PARTIAL' && <div className="grid gap-4 md:grid-cols-2"><label htmlFor="inventory-categories" className="block text-sm font-medium">Categorias (opcional)<select id="inventory-categories" multiple size={7} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={form.watch('categoryIds')} onChange={(event) => form.setValue('categoryIds', Array.from(event.currentTarget.selectedOptions, (option) => option.value), { shouldValidate: true })}>{categories.data?.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Se escolher categorias e produtos, o inventário inclui os dois conjuntos.</span></label><fieldset className="max-h-64 overflow-y-auto rounded-lg border p-3 dark:border-slate-700"><legend className="px-1 text-sm font-medium">Produtos (opcional)</legend>{products.data?.products.map((product: ProductListItem) => <label key={product.id} className="flex items-center gap-2 py-1.5 text-sm"><input type="checkbox" checked={form.watch('productIds').includes(product.id)} onChange={(event) => { const selected = form.getValues('productIds'); form.setValue('productIds', event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id), { shouldValidate: true }); }} />{product.name} · {product.sku}</label>)}</fieldset></div>}
      {form.formState.errors.productIds && <p role="alert" className="text-sm text-red-700">{form.formState.errors.productIds.message}</p>}
      <label htmlFor="inventory-observations" className="block text-sm font-medium">Observações<textarea id="inventory-observations" rows={2} maxLength={500} className="mt-1.5 w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-950" {...form.register('observations')} /></label>
      <button type="submit" disabled={createMutation.isPending || (selectedType === 'PARTIAL' && (categories.isLoading || products.isLoading))} className="rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{createMutation.isPending ? 'Criando…' : 'Criar e iniciar contagem'}</button>
    </form></section>}

    {inventories.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando inventários…</p>}
    {inventories.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{inventories.error.message}</p>}
    {inventories.data?.inventories.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Nenhum inventário cadastrado.</p>}
    {inventories.data && inventories.data.inventories.length > 0 && <><div className="overflow-x-auto rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><caption className="sr-only">Inventários cadastrados</caption><thead><tr><th className="px-4 py-3">Iniciado em</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Itens</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead><tbody>{inventories.data.inventories.map((item) => <tr key={item.id} className="border-t dark:border-slate-800"><td className="px-4 py-3">{displayDate(item.startedAt)}</td><td className="px-4 py-3">{item.type === 'COMPLETE' ? 'Completo' : 'Parcial'}</td><td className="px-4 py-3">{item._count.items}</td><td className="px-4 py-3">{item.createdBy.name}</td><td className="px-4 py-3">{item.status === 'EM_ANDAMENTO' ? 'Em andamento' : item.status === 'AGUARDANDO_CONFERENCIA' ? 'Aguardando conferência' : item.status === 'CONFIRMADO' ? 'Confirmado' : 'Cancelado'}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedInventoryId(item.id)} className="font-semibold text-[#0045B5]">Abrir contagem</button></td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between text-sm"><span>{inventories.data.total} inventário(s)</span><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Página {page} de {Math.max(inventories.data.totalPages, 1)}</span><button type="button" disabled={page >= inventories.data.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button></div></div></>}

    {selectedInventoryId && <section aria-labelledby="inventory-detail-title" className="mt-6 rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 id="inventory-detail-title" className="text-lg font-semibold">Contagem do inventário</h2>{inventory.data && <p className="mt-1 text-sm text-slate-500">Snapshot de {displayDate(inventory.data.startedAt)}. O esperado considera movimentos posteriores.</p>}</div><button type="button" onClick={() => setSelectedInventoryId('')} className="rounded-lg border px-3 py-2 text-sm font-semibold">Fechar</button></div>{inventory.isLoading && <p role="status" className="py-5 text-sm text-slate-500">Carregando itens…</p>}{inventory.isError && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{inventory.error.message}</p>}{countMutation.isError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{countMutation.error.message}</p>}{countMutation.isSuccess && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Contagem salva. O estoque continua recebendo movimentações.</p>}{inventory.data?.items.length === 0 && <p className="text-sm text-slate-500">Este inventário não tem itens para contar.</p>}{inventory.data && inventory.data.items.length > 0 && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><caption className="sr-only">Itens do inventário e suas contagens</caption><thead><tr><th className="px-3 py-2">Produto / lote</th><th className="px-3 py-2">Snapshot</th><th className="px-3 py-2">Esperado agora</th><th className="px-3 py-2">Contagem física</th><th className="px-3 py-2">Diferença contagem − esperado</th></tr></thead><tbody>{inventory.data.items.map((item) => <InventoryCountRow key={item.id} item={item} disabled={inventory.data?.status !== 'EM_ANDAMENTO' || countMutation.isPending} onSave={(countedQuantity) => countMutation.mutate({ itemId: item.id, countedQuantity })} />)}</tbody></table></div>}</section>}
  </section>;
}
