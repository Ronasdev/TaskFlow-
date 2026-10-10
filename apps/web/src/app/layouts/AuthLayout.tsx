import { CheckCircle2 } from 'lucide-react';
import { Outlet } from 'react-router';
import { Logo } from './Logo';

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <main className="flex flex-col justify-center px-4 py-12 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          <Outlet />
        </div>
      </main>
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10" aria-hidden />
        <div className="absolute -bottom-32 -left-16 size-80 rounded-full bg-white/5" aria-hidden />
        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-semibold tracking-tight">
            Vos tâches, vos projets, votre rythme.
          </h2>
          <ul className="mt-8 space-y-4 text-white/85">
            {[
              'Un espace personnel privé, prêt dès l’inscription',
              'Des projets partagés avec des rôles clairs',
              'Un tableau de bord pour ne rien laisser filer',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
