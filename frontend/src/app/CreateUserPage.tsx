import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createUser } from '@/lib/api';

const createUserSchema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  name: z.string().min(2, 'Informe o nome completo.'),
  password: z.string().min(12, 'A senha deve ter pelo menos 12 caracteres.'),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export function CreateUserPage() {
  const mutation = useMutation({ mutationFn: createUser });
  const { formState: { errors }, handleSubmit, register, reset } = useForm<CreateUserForm>({ resolver: zodResolver(createUserSchema), defaultValues: { role: 'OPERATOR' } });

  function submit(values: CreateUserForm): void {
    mutation.mutate(values, { onSuccess: () => reset({ role: 'OPERATOR' }) });
  }

  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="create-user-title">
      <div className="mb-6"><p className="text-sm font-semibold text-[#0045B5]">Administração</p><h1 id="create-user-title" className="mt-1 text-2xl font-bold">Novo usuário</h1><p className="mt-2 text-sm text-slate-500">Crie um acesso administrativo com o perfil adequado.</p></div>
      <form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900" onSubmit={handleSubmit(submit)} noValidate>
        <div><label htmlFor="user-name" className="mb-1.5 block text-sm font-medium">Nome</label><input id="user-name" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('name')} />{errors.name && <p className="mt-1 text-sm text-red-600" role="alert">{errors.name.message}</p>}</div>
        <div><label htmlFor="user-email" className="mb-1.5 block text-sm font-medium">E-mail</label><input id="user-email" type="email" autoComplete="email" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('email')} />{errors.email && <p className="mt-1 text-sm text-red-600" role="alert">{errors.email.message}</p>}</div>
        <div><label htmlFor="user-password" className="mb-1.5 block text-sm font-medium">Senha inicial</label><input id="user-password" type="password" autoComplete="new-password" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('password')} />{errors.password && <p className="mt-1 text-sm text-red-600" role="alert">{errors.password.message}</p>}</div>
        <div><label htmlFor="user-role" className="mb-1.5 block text-sm font-medium">Perfil</label><select id="user-role" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0045B5] focus:ring-2 focus:ring-[#0045B5]/20 dark:border-slate-700 dark:bg-slate-950" {...register('role')}><option value="ADMIN">Administrador</option><option value="OPERATOR">Operador</option><option value="VIEWER">Visualizador</option></select></div>
        {mutation.isError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{mutation.error.message}</p>}
        {mutation.isSuccess && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700" role="status">Usuário criado com sucesso.</p>}
        <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-[#0045B5] px-4 py-2.5 font-semibold text-white hover:bg-[#00398f] disabled:cursor-not-allowed disabled:opacity-60">{mutation.isPending ? 'Criando…' : 'Criar usuário'}</button>
      </form>
    </section>
  );
}
