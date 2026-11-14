import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type StateProps = { title: string; description?: string; action?: ReactNode };

export function LoadingState({ title = 'Carregando', description = 'Aguarde um momento.' }: StateProps) {
  return <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-3 py-12 text-center"><LoaderCircle className="animate-spin text-[#0045B5]" aria-hidden="true" /><h2 className="font-semibold">{title}</h2><p className="text-sm text-slate-500">{description}</p></div>;
}

export function EmptyState({ title, description, action }: StateProps) {
  return <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700"><Inbox className="text-slate-400" aria-hidden="true" /><h2 className="font-semibold">{title}</h2>{description && <p className="text-sm text-slate-500">{description}</p>}{action}</div>;
}

export function ErrorState({ title, description, action }: StateProps) {
  return <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"><AlertCircle aria-hidden="true" /><h2 className="font-semibold">{title}</h2>{description && <p className="text-sm opacity-80">{description}</p>}{action}</div>;
}
