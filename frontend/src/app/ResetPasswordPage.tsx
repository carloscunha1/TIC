import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { completePasswordReset } from '@/lib/api';

const resetSchema = z.object({ password: z.string().min(12, 'A senha deve ter pelo menos 12 caracteres.'), confirmation: z.string() }).refine((data) => data.password === data.confirmation, { message: 'As senhas precisam ser iguais.', path: ['confirmation'] });
type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const mutation = useMutation({ mutationFn: (values: ResetForm) => completePasswordReset({ password: values.password, token }), onSuccess: () => navigate('/login', { replace: true }) });
  const { formState: { errors }, handleSubmit, register } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-slate-950"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" aria-labelledby="reset-title"><h1 id="reset-title" className="text-2xl font-bold">Definir nova senha</h1><p className="mt-2 text-sm text-slate-500">Use a credencial temporária recebida para definir sua senha.</p><form className="mt-6 space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate><div><label htmlFor="reset-password" className="mb-1.5 block text-sm font-medium">Nova senha</label><input id="reset-password" type="password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...register('password')} />{errors.password && <p className="mt-1 text-sm text-red-600" role="alert">{errors.password.message}</p>}</div><div><label htmlFor="reset-confirmation" className="mb-1.5 block text-sm font-medium">Confirmar nova senha</label><input id="reset-confirmation" type="password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" {...register('confirmation')} />{errors.confirmation && <p className="mt-1 text-sm text-red-600" role="alert">{errors.confirmation.message}</p>}</div>{mutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{mutation.error.message}</p>}<button type="submit" disabled={mutation.isPending || !token} className="w-full rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white disabled:opacity-60">{mutation.isPending ? 'Salvando…' : 'Definir senha'}</button></form></section></main>;
}
