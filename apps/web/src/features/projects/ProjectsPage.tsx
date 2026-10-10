import { FolderKanban, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
  Skeleton,
} from '@/components/ui/display';
import { useProjects } from './api';
import { ProjectFormDialog } from './components/ProjectFormDialog';
import { RoleBadge } from './components/RoleBadge';

export function ProjectsPage() {
  const projects = useProjects();
  const [creating, setCreating] = useState(false);

  const newProjectButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus className="size-4" /> Nouveau projet
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Projets"
        description="Les projets dont vous êtes membre."
        actions={newProjectButton}
      />

      {projects.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : projects.isError ? (
        <ErrorState message={projects.error.message} onRetry={() => void projects.refetch()} />
      ) : projects.data.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Aucun projet" action={newProjectButton} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => {
            const { TODO, IN_PROGRESS, DONE } = project.taskCounts;
            const total = TODO + IN_PROGRESS + DONE;
            return (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="block h-full rounded-2xl">
                  <Card className="flex h-full flex-col gap-4 p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold">{project.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">
                          {project.isPersonal
                            ? 'Vos tâches personnelles, visibles par vous seul.'
                            : (project.description ?? 'Aucune description')}
                        </p>
                      </div>
                      <RoleBadge role={project.myRole} />
                    </div>
                    <div className="mt-auto space-y-2">
                      <ProgressBar
                        value={total ? DONE / total : 0}
                        label={`Avancement de ${project.name}`}
                      />
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>
                          {DONE}/{total} terminée{DONE > 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden /> {project.memberCount}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <ProjectFormDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
