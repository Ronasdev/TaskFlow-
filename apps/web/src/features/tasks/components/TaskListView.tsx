import type { UseQueryResult } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ListTodo } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, Skeleton } from '@/components/ui/display';
import type { Paginated, ProjectRole, Task } from '@/types/api';
import { TaskItem } from './TaskItem';

interface TaskListViewProps {
  query: UseQueryResult<Paginated<Task>>;
  roleOf: (task: Task) => ProjectRole;
  onOpen: (task: Task) => void;
  onPageChange: (page: number) => void;
  showProject?: boolean;
  emptyAction?: ReactNode;
  filtered?: boolean;
}

/** Liste paginée avec les trois états obligatoires : chargement, vide, erreur. */
export function TaskListView({
  query,
  roleOf,
  onOpen,
  onPageChange,
  showProject,
  emptyAction,
  filtered,
}: TaskListViewProps) {
  if (query.isPending) {
    return (
      <Card className="divide-y divide-border" aria-busy>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex gap-3 px-4 py-4">
            <Skeleton className="size-5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </Card>
    );
  }

  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />;
  }

  const { data, meta } = query.data;
  if (data.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title={filtered ? 'Aucune tâche ne correspond' : 'Aucune tâche pour le moment'}
        description={
          filtered
            ? 'Essayez de modifier vos filtres.'
            : 'Créez votre première tâche pour commencer.'
        }
        action={filtered ? undefined : emptyAction}
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  return (
    <>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {data.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              role={roleOf(task)}
              onOpen={() => onOpen(task)}
              showProject={showProject}
            />
          ))}
        </ul>
      </Card>
      {pageCount > 1 && (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted">
            {meta.total} tâche{meta.total > 1 ? 's' : ''} · page {meta.page} sur {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              <ChevronLeft className="size-4" /> Précédente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= pageCount}
              onClick={() => onPageChange(meta.page + 1)}
            >
              Suivante <ChevronRight className="size-4" />
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
