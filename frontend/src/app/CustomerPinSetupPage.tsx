import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { completeCustomerPinSetup } from '@/lib/api';
const schema = z.object({ pin: z.string().regex(/^\d{6}$/, 'Informe seis dígitos.'), confirmation: z.string() }).refine((value) => value.pin === value.confirmation, { path: ['confirmation'], message: 'Os PINs não coincidem.' });
type FormValues = z.infer<typeof schema>;
export function CustomerPinSetupPage() {
  const token = useMemo(() => { const value = new URLSearchParams(window.location.hash.slice(1)).get('token'); window.history.replaceState({}, '', window.location.pathname); return value ?? ''; }, []);
  const [done, setDone] = useState(false);
  const mutation = useMutation({ mutationFn: (values: FormValues) => completeCustomerPinSetup(token, values.pin), onSuccess: () => setDone(true) });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8"><h1 className="text-2xl font-bold">Defina seu PIN</h1><p className="mt-2 text-sm text-slate-600">Crie um PIN numérico de seis dígitos para acessar sua conta.</p>{done ? <p className="mt-6 rounded-lg bg-green-50 p-4 text-green-800" role="status">PIN definido. Você já pode entrar com seu telefone e PIN.</p> : !token ? <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700" role="alert">Este link expirou ou não é válido. Solicite um novo link no estabelecimento.</p> : <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}><label className="block text-sm font-medium">Novo PIN<input {...register('pin')} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>{errors.pin && <p role="alert" className="text-sm text-red-700">{errors.pin.message}</p>}<label className="block text-sm font-medium">Confirme o PIN<input {...register('confirmation')} type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>{errors.confirmation && <p role="alert" className="text-sm text-red-700">{errors.confirmation.message}</p>}{mutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">O link expirou ou já foi utilizado. Solicite um novo link no estabelecimento.</p>}<button disabled={mutation.isPending} className="w-full rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Definir PIN'}</button></form>}</section></main>;
}
