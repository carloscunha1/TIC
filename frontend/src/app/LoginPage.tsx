import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockKeyhole, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { login } from '@/lib/api';

const loginFormSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginForm = z.infer<typeof loginFormSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate('/'),
  });
  const { formState: { errors }, handleSubmit, register } = useForm<LoginForm>({ resolver: zodResolver(loginFormSchema) });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:p-8" aria-labelledby="login-title">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFD100] text-xl font-black text-[#0045B5]">T</div>
          <h1 id="login-title" className="text-2xl font-bold text-slate-950 dark:text-white">Entrar no TIC</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Acesse o painel administrativo</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit((values: LoginForm) => loginMutation.mutate(values))} noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">E-mail</label>
            <div className="relative">
              <Mail aria-hidden="true" className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input id="email" type="email" autoComplete="email" className="w-full rounded-lg border border-slate-300 bg-white px-10 py-3 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('email')} />
            </div>
            {errors.email && <p className="mt-1 text-sm text-red-600" role="alert">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Senha</label>
            <div className="relative">
              <LockKeyhole aria-hidden="true" className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input id="password" type="password" autoComplete="current-password" className="w-full rounded-lg border border-slate-300 bg-white px-10 py-3 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('password')} />
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-600" role="alert">{errors.password.message}</p>}
          </div>

          {loginMutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">Não foi possível autenticar. Verifique seus dados e tente novamente.</p>}

          <button type="submit" disabled={loginMutation.isPending} className="w-full rounded-lg bg-[#0045B5] px-4 py-3 font-semibold text-white transition hover:bg-[#00398f] disabled:cursor-not-allowed disabled:opacity-60">
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  );
}
