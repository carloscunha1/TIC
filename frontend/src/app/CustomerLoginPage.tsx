import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getCustomerSession, loginCustomer, logoutCustomer } from '@/lib/api';
const schema = z.object({ phone: z.string().min(1, 'Informe o telefone.'), pin: z.string().regex(/^\d{6}$/, 'O PIN deve conter seis dígitos.') });
type FormValues = z.infer<typeof schema>;
export function CustomerLoginPage() {
  const [name, setName] = useState('');
  const loginMutation = useMutation({ mutationFn: (values: FormValues) => loginCustomer(values.phone, values.pin), onSuccess: async () => setName((await getCustomerSession()).name) });
  const logoutMutation = useMutation({ mutationFn: logoutCustomer, onSuccess: () => { setName(''); loginMutation.reset(); } });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8"><h1 className="text-2xl font-bold">Acesso do cliente</h1><p className="mt-2 text-sm text-slate-600">Entre com seu telefone e PIN de seis dígitos.</p>{name ? <div className="mt-6"><p role="status">Autenticação realizada.</p><button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="mt-4 rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white">{logoutMutation.isPending ? 'Saindo…' : 'Sair'}</button></div> : <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}><label className="block text-sm font-medium">Telefone<input {...register('phone')} type="tel" autoComplete="tel" className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>{errors.phone && <p role="alert" className="text-sm text-red-700">{errors.phone.message}</p>}<label className="block text-sm font-medium">PIN<input {...register('pin')} type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label>{errors.pin && <p role="alert" className="text-sm text-red-700">{errors.pin.message}</p>}{loginMutation.isError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Telefone ou PIN inválidos.</p>}<button disabled={loginMutation.isPending} className="w-full rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white disabled:opacity-60">{loginMutation.isPending ? 'Entrando…' : 'Entrar'}</button></form>}</section></main>;
}
