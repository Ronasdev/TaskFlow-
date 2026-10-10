import { AlertTriangle, CircleCheck, CircleDashed, ListTodo, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Card, ErrorState, PageHeader, ProgressBar, Skeleton } from '@/components/ui/display';
import { formatRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/api';
import { useCurrentUser } from '../auth/auth-context';
import { useDashboard } from '../projects/api';
import { RoleBadge } from '../projects/components/RoleBadge';
import { DueBadge, PriorityBadge } from '../tasks/components/badges';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';
}

export function DashboardPage() {
  const user = useCurrentUser();
  const dashboard = useDashboard();

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.name.split(' ')[0]}`}
        description="Voici où en sont vos tâches."
      />

      {dashboard.isPending ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : dashboard.isError ? (
        <ErrorState message={dashboard.error.message} onRetry={() => void dashboard.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={ListTodo} label="À faire" value={dashboard.data.counts.TODO} />
            <StatCard
              icon={CircleDashed}
              label="En cours"
              value={dashboard.data.counts.IN_PROGRESS}
            />
            <StatCard icon={CircleCheck} label="Terminées" value={dashboard.data.counts.DONE} />
            <StatCard
              icon={AlertTriangle}
              label="En retard"
              value={dashboard.data.overdue}
              tone={dashboard.data.overdue > 0 ? 'danger' : 'default'}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <TaskSection
              title="Assignées à moi"
              tasks={dashboard.data.assignedToMe}
              empty="Aucune tâche ouverte ne vous est assignée."
              link="/tasks"
            />
            <TaskSection
              title="Échéances des 7 prochains jours"
              tasks={dashboard.data.dueSoon}
              empty="Aucune échéance proche."
            />
            <Card className="p-5">
              <SectionTitle title="Projets" link="/projects" />
              <ul className="mt-4 space-y-4">
                {dashboard.data.projects.map((project) => (
                  <li key={project.id}>
                    <Link to={`/projects/${project.id}`} className="group block">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium group-hover:text-primary">
                          {project.name}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {Math.round(project.progress * 100)} %
                          {!project.isPersonal && <RoleBadge role={project.myRole} />}
                        </span>
                      </div>
                      <ProgressBar
                        value={project.progress}
                        label={`Avancement de ${project.name}`}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <SectionTitle title="Récemment terminées" />
              {dashboard.data.recentlyCompleted.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Rien de terminé pour l'instant.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {dashboard.data.recentlyCompleted.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 text-sm">
                      <CircleCheck className="size-4 shrink-0 text-emerald-500" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {task.completedAt && (
                        <span className="shrink-0 text-xs text-muted">
                          {formatRelative(task.completedAt)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: 'default' | 'danger';
}) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-xl',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary',
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

function SectionTitle({ title, link }: { title: string; link?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-semibold">{title}</h2>
      {link && (
        <Link to={link} className="text-sm text-primary hover:underline">
          Tout voir
        </Link>
      )}
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  empty,
  link,
}: {
  title: string;
  tasks: Task[];
  empty: string;
  link?: string;
}) {
  return (
    <Card className="p-5">
      <SectionTitle title={title} link={link} />
      {tasks.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {tasks.map((task) => (
            <li key={task.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link
                to={`/projects/${task.projectId}`}
                className="text-sm font-medium hover:text-primary"
              >
                {task.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={task.priority} />
                {task.dueDate && <DueBadge dueDate={task.dueDate} done={false} />}
                <span className="text-xs text-muted">· {task.projectName}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
