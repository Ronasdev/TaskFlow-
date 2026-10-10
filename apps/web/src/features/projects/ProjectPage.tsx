import { Columns3, List, Plus, Settings } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/display';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { NotFoundPage } from '@/app/NotFoundPage';
import type { Task, TaskFilters as Filters } from '@/types/api';
import { useTasks } from '../tasks/api';
import { TaskBoard } from '../tasks/components/TaskBoard';
import { TaskFilters } from '../tasks/components/TaskFilters';
import { TaskFormDialog } from '../tasks/components/TaskFormDialog';
import { TaskListView } from '../tasks/components/TaskListView';
import { useProject } from './api';
import { RoleBadge } from './components/RoleBadge';
import { can } from './permissions';

type View = 'list' | 'board';
const VIEW_KEY = 'taskflow-project-view';

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  } catch {
    return 'list';
  }
}

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const project = useProject(projectId);
  const [view, setView] = useState<View>(readView);
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 20 });
  const [dialog, setDialog] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });

  // Le Kanban affiche toutes les tâches du projet (jusqu'à 100) sans pagination ni filtre de statut.
  const listFilters =
    view === 'board' ? { ...filters, status: undefined, page: 1, pageSize: 100 } : filters;
  const tasks = useTasks(listFilters, projectId);
  const onFiltersChange = useCallback((next: Filters) => setFilters(next), []);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // stockage indisponible : préférence non mémorisée
    }
  };

  if (project.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (project.isError) {
    if (project.error instanceof ApiError && project.error.status === 404) return <NotFoundPage />;
    return <ErrorState message={project.error.message} onRetry={() => void project.refetch()} />;
  }

  const { myRole } = project.data;
  const newTaskButton = can.createTask(myRole) && (
    <Button onClick={() => setDialog({ open: true, task: null })}>
      <Plus className="size-4" /> Nouvelle tâche
    </Button>
  );

  return (
    <>
      <PageHeader
        title={project.data.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RoleBadge role={myRole} />
            {project.data.description}
          </span>
        }
        actions={
          <>
            <div
              className="flex rounded-lg border border-border bg-surface p-0.5"
              role="group"
              aria-label="Affichage"
            >
              {(
                [
                  ['list', List, 'Liste'],
                  ['board', Columns3, 'Tableau'],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => changeView(value)}
                  className={cn(
                    'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                    view === value
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden /> {label}
                </button>
              ))}
            </div>
            <Link
              to={`/projects/${projectId}/settings`}
              aria-label="Paramètres du projet"
              title="Paramètres du projet"
              className="grid size-9 place-items-center rounded-lg border border-border bg-surface shadow-sm transition-colors hover:bg-surface-muted"
            >
              <Settings className="size-4" />
            </Link>
            {newTaskButton}
          </>
        }
      />

      <TaskFilters value={filters} onChange={onFiltersChange} />

      {view === 'board' && tasks.data ? (
        <TaskBoard
          tasks={tasks.data.data}
          role={myRole}
          onOpen={(task) => setDialog({ open: true, task })}
        />
      ) : (
        <TaskListView
          query={tasks}
          roleOf={() => myRole}
          onOpen={(task) => setDialog({ open: true, task })}
          onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          filtered={!!(filters.status || filters.priority || filters.q)}
          emptyAction={newTaskButton || undefined}
        />
      )}

      <TaskFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        task={dialog.task}
        projects={[project.data]}
        defaultProjectId={projectId}
      />
    </>
  );
}
