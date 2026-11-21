import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSale, returnSale } from '@/lib/api';

export function SaleReturnPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['sales', id], queryFn: () => getSale(id) });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [destinations, setDestinations] = useState<Record<string, 'COMERCIALIZAVEL' | 'PERDA'>>({});
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'PIX' | 'DEBIT' | 'CREDIT' | 'OTHER' | null>('CASH');
  const [refundAmount, setRefundAmount] = useState('');
  const [validationError, setValidationError] = useState('');
  const selectedItems = useMemo(() => (query.data?.items ?? []).flatMap((item) => {
    const quantity = Number(quantities[item.id] ?? 0);
    return quantity > 0 ? [{ saleItemId: item.id, quantity, destination: destinations[item.id] ?? 'COMERCIALIZAVEL', total: quantity * Number(item.unitPrice) }] : [];
  }), [destinations, quantities, query.data?.items]);
  const suggestedRefund = selectedItems.reduce((total, item) => total + item.total, 0);
  useEffect(() => {
    if (query.data) {
      setPaymentMethod(query.data.paymentMethod === 'LOYALTY' ? null : query.data.paymentMethod ?? 'CASH');
    }
  }, [query.data]);
  useEffect(() => {
    setRefundAmount(suggestedRefund.toFixed(2));
  }, [suggestedRefund]);
  const mutation = useMutation({
    mutationFn: () => {
      if (selectedItems.length === 0) {
        setValidationError('Selecione ao menos um item para devolver.');
        throw new Error('Selecione ao menos um item para devolver.');
      }
      const amount = Number(refundAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        setValidationError('Informe um valor de reembolso válido.');
        throw new Error('Informe um valor de reembolso válido.');
      }
      setValidationError('');
      return returnSale(id, { items: selectedItems.map((item) => ({ saleItemId: item.saleItemId, quantity: item.quantity, destination: item.destination })), refundAmount: amount, refundPaymentMethod: query.data?.paymentMethod === 'LOYALTY' ? null : paymentMethod });
    },
    onSuccess: () => navigate('/vendas'),
  });
  if (query.isLoading) return <p role="status">Carregando venda…</p>;
  if (query.isError || !query.data) return <p role="alert">Não foi possível carregar a venda.</p>;
  return <section aria-labelledby="return-title" className="text-slate-900 dark:text-slate-100">
    <div className="mb-6"><Link to="/vendas" className="text-sm font-semibold text-[#0045B5] dark:text-blue-300">← Voltar para vendas</Link><h1 id="return-title" className="mt-2 text-2xl font-bold">Registrar devolução</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Selecione quantidades ainda não devolvidas e o destino de cada item.</p></div>
    {(validationError || mutation.isError) && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{validationError || mutation.error?.message || 'Não foi possível registrar a devolução.'}</p>}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-800"><tr><th className="px-4 py-3 text-slate-700 dark:text-slate-200">Produto</th><th className="px-4 py-3 text-slate-700 dark:text-slate-200">Quantidade</th><th className="px-4 py-3 text-slate-700 dark:text-slate-200">Destino</th></tr></thead><tbody>{query.data.items.map((item) => <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-4 py-3 text-slate-900 dark:text-slate-100">{item.product.name}</td><td className="px-4 py-3"><input aria-label={`Quantidade de ${item.product.name}`} className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" min="0" max={item.quantity} step="0.001" type="number" value={quantities[item.id] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} /></td><td className="px-4 py-3"><select aria-label={`Destino de ${item.product.name}`} className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={destinations[item.id] ?? 'COMERCIALIZAVEL'} onChange={(event) => setDestinations((current) => ({ ...current, [item.id]: event.target.value as 'COMERCIALIZAVEL' | 'PERDA' }))}><option value="COMERCIALIZAVEL">Comercializável</option><option value="PERDA">Perda</option></select></td></tr>)}</tbody></table></div>
    <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm text-slate-700 dark:text-slate-200">Valor do reembolso *<input aria-label="Valor do reembolso *" className="mt-1 block w-32 rounded border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" min="0" step="0.01" type="number" value={query.data.paymentMethod === 'LOYALTY' ? '0.00' : refundAmount} disabled={query.data.paymentMethod === 'LOYALTY'} onChange={(event) => setRefundAmount(event.target.value)} /></label>{query.data.paymentMethod !== 'LOYALTY' && <label className="text-sm text-slate-700 dark:text-slate-200">Forma de reembolso<select aria-label="Forma de reembolso" className="mt-1 block rounded border border-slate-300 bg-white px-2 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" value={paymentMethod ?? ''} onChange={(event) => setPaymentMethod((event.target.value || null) as typeof paymentMethod)}><option value="CASH">Dinheiro</option><option value="PIX">PIX</option><option value="DEBIT">Débito</option><option value="CREDIT">Crédito</option><option value="OTHER">Outra</option></select></label>}<p className="text-sm text-slate-500 dark:text-slate-400">Calculado: R$ {suggestedRefund.toFixed(2)}</p><button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Registrando…' : 'Confirmar devolução'}</button></div>
  </section>;
}
