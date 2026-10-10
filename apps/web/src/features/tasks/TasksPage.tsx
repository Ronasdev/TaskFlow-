import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/display';
import type { Task, TaskFilters as Filters } from '@/types/api';
import { useProjects } from '../projects/api';
import { can } from '../projects/permissions';
import { useTasks } from './api';
import { TaskFilters } from './components/TaskFilters';
import { TaskFormDialog } from './components/TaskFormDialog';
import { TaskListView } from './components/TaskListView';

/** Toutes mes tâches, tous projets confondus. */
export function TasksPage() {
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 20 });
  const [dialog, setDialog] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const tasks = useTasks(filters);
  const projects = useProjects();

  const roles = useMemo(
    () => new Map(projects.data?.map((project) => [project.id, project.myRole])),
    [projects.data],
  );
  const creatable = projects.data?.filter((project) => can.createTask(project.myRole)) ?? [];
  const onFiltersChange = useCallback((next: Filters) => setFilters(next), []);

  const newTaskButton = (
    <Button onClick={() => setDialog({ open: true, task: null })} disabled={creatable.length === 0}>
      <Plus className="size-4" /> Nouvelle tâche
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Mes tâches"
        description="Toutes les tâches de vos projets."
        actions={newTaskButton}
      />
      <TaskFilters value={filters} onChange={onFiltersChange} showAssignedToMe />
      <TaskListView
        query={tasks}
        roleOf={(task) => roles.get(task.projectId) ?? 'VIEWER'}
        onOpen={(task) => setDialog({ open: true, task })}
        onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
        showProject
        filtered={!!(filters.status || filters.priority || filters.q || filters.assignedToMe)}
        emptyAction={newTaskButton}
      />
      <TaskFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        task={dialog.task}
        projects={dialog.task ? (projects.data ?? []) : creatable}
      />
    </>
  );
}
