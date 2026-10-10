import { SearchX } from 'lucide-react';
import { Link } from 'react-router';

/** Identique qu'une ressource n'existe pas ou ne soit pas accessible (politique 404). */
export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
        <SearchX className="size-7" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">Page introuvable</h1>
        <p className="mt-1 text-sm text-muted">Cette page n'existe pas ou n'est plus disponible.</p>
      </div>
      <Link to="/" className="text-sm font-medium text-primary hover:underline">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
