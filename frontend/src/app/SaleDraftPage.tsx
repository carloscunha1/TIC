import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addSaleItem, createSale, getSale, listCustomers, listProducts, removeSaleItem, updateSale, updateSaleItem, type SaleView } from '@/lib/api';

export function SaleDraftPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const client = useQueryClient();
  const sale = useQuery({ queryKey: ['sales', id], queryFn: () => getSale(id!), enabled: editing });
  const products = useQuery({ queryKey: ['products', 'active-for-sale'], queryFn: () => listProducts({ page: 1, pageSize: 100, status: 'ACTIVE' }) });
  const customers = useQuery({ queryKey: ['customers', 'active-for-sale'], queryFn: () => listCustomers({ page: 1, pageSize: 100, status: 'ACTIVE' }) });
  const [customerId, setCustomerId] = useState('');
  const [observations, setObservations] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sale.data) { setCustomerId(sale.data.customerId ?? ''); setObservations(sale.data.observations ?? ''); }
  }, [sale.data]);

  const refresh = (next: SaleView) => { client.setQueryData(['sales', id], next); client.invalidateQueries({ queryKey: ['sales'] }); };
  const create = useMutation({ mutationFn: () => createSale({ customerId: customerId || null, observations: observations || null, items: [{ productId, quantity }] }), onSuccess: (next) => { refresh(next); navigate(`/vendas/${next.id}/editar`); } });
  const save = useMutation({ mutationFn: () => updateSale(id!, { customerId: customerId || null, observations: observations || null }), onSuccess: refresh });
  const add = useMutation({ mutationFn: () => addSaleItem(id!, { productId, quantity }), onSuccess: (next) => { refresh(next); setProductId(''); setQuantity(1); } });
  const change = useMutation({ mutationFn: ({ itemId, value }: { itemId: string; value: number }) => updateSaleItem(id!, itemId, value), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (itemId: string) => removeSaleItem(id!, itemId), onSuccess: refresh });
  const current = sale.data;
  const submit = () => { setError(''); if (!productId || quantity <= 0) { setError('Informe produto e quantidade.'); return; } if (editing) add.mutate(); else create.mutate(); };

  if (editing && sale.isLoading) return <p role="status">Carregando venda…</p>;
  if (editing && (sale.isError || !current)) return <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{sale.error?.message ?? 'Venda não encontrada.'}</p>;
  if (editing && current?.status !== 'EM_ANDAMENTO') return <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Esta venda não está em andamento e não pode ser editada.</p>;
  return <section className="mx-auto max-w-4xl" aria-labelledby="sale-draft-title">
    <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Operação</p><h1 id="sale-draft-title" className="mt-1 text-2xl font-bold">{editing ? 'Editar venda em andamento' : 'Nova venda'}</h1><p className="mt-2 text-sm text-slate-500">O estoque só será validado e baixado na confirmação.</p></div>
    {(products.isLoading || customers.isLoading) && <p role="status">Carregando opções…</p>}
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><label className="block text-sm font-medium">Cliente (opcional)<select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Sem cliente</option>{customers.data?.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label><label className="mt-4 block text-sm font-medium">Observações<textarea value={observations} maxLength={500} onChange={(event) => setObservations(event.target.value)} className="mt-1.5 w-full rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" rows={3} /></label>{editing && <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold">Salvar dados</button>}</div>
      <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 text-lg font-semibold">{editing ? 'Adicionar item' : 'Item inicial'}</h2><div className="grid gap-4 sm:grid-cols-[1fr_180px]"><select value={productId} onChange={(event) => setProductId(event.target.value)} className="rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950"><option value="">Selecione o produto</option>{products.data?.products.map((product) => <option key={product.id} value={product.id}>{product.name} · R$ {Number(product.salePrice).toFixed(2)}</option>)}</select><input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="rounded-lg border px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></div><button type="button" onClick={submit} disabled={create.isPending || add.isPending} className="mt-4 rounded-lg bg-[#0045B5] px-4 py-2.5 text-sm font-semibold text-white">{editing ? 'Adicionar item' : 'Criar venda'}</button>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{(create.error || add.error || save.error) && <p role="alert" className="mt-3 text-sm text-red-700">{(create.error || add.error || save.error)?.message}</p>}</div>
      {current && <div className="rounded-xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-4 text-lg font-semibold">Itens · R$ {Number(current.total).toFixed(2)}</h2>{current.items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t py-3 first:border-t-0"><span>{item.product.name} · R$ {Number(item.unitPrice).toFixed(2)}</span><div className="flex items-center gap-2"><input aria-label={`Quantidade de ${item.product.name}`} type="number" min="0.001" step="0.001" defaultValue={item.quantity} onBlur={(event) => { const value = Number(event.target.value); if (value > 0 && value !== Number(item.quantity)) change.mutate({ itemId: item.id, value }); }} className="w-24 rounded-lg border px-2 py-1.5" /><button type="button" onClick={() => remove.mutate(item.id)} disabled={current.items.length === 1 || remove.isPending} className="text-sm font-semibold text-red-700 disabled:opacity-40">Remover</button></div></div>)}</div>}
      <Link to="/vendas" className="inline-block text-sm font-semibold text-[#0045B5]">Voltar para vendas</Link>
    </div>
  </section>;
}
