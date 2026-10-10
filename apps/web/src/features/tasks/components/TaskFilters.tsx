import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/form';
import { cn } from '@/lib/utils';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskFilters as Filters,
  type TaskPriority,
} from '@/types/api';
import { PRIORITY_META, STATUS_META } from '../labels';

interface TaskFiltersProps {
  value: Filters;
  onChange: (value: Filters) => void;
  showAssignedToMe?: boolean;
}

const SORTS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Plus récentes' },
  { value: 'dueDate:asc', label: 'Échéance proche' },
  { value: 'priority:desc', label: 'Priorité haute' },
  { value: 'updatedAt:desc', label: 'Modifiées récemment' },
];

export function TaskFilters({ value, onChange, showAssignedToMe = false }: TaskFiltersProps) {
  const [search, setSearch] = useState(value.q ?? '');

  // Recherche différée : évite une requête par frappe.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((value.q ?? '') !== search) onChange({ ...value, q: search || undefined, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  const toggleStatus = (status: (typeof TASK_STATUSES)[number]) => {
    const current = value.status ?? [];
    const next = current.includes(status)
      ? current.filter((item) => item !== status)
      : [...current, status];
    onChange({ ...value, status: next.length ? next : undefined, page: 1 });
  };

  const hasFilters = !!(
    value.status?.length ||
    value.priority?.length ||
    value.q ||
    value.assignedToMe
  );

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une tâche…"
            aria-label="Rechercher une tâche"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="Priorité"
            value={value.priority?.[0] ?? ''}
            onChange={(event) =>
              onChange({
                ...value,
                priority: event.target.value ? [event.target.value as TaskPriority] : undefined,
                page: 1,
              })
            }
            className="sm:w-40"
          >
            <option value="">Toutes priorités</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_META[priority].label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Trier par"
            value={`${value.sort ?? 'createdAt'}:${value.order ?? 'desc'}`}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(':') as [
                Filters['sort'],
                Filters['order'],
              ];
              onChange({ ...value, sort, order, page: 1 });
            }}
            className="sm:w-48"
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filtrer par statut"
      >
        {TASK_STATUSES.map((status) => {
          const active = value.status?.includes(status) ?? false;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={cn(
                'h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface text-muted hover:text-foreground',
              )}
            >
              {STATUS_META[status].label}
            </button>
          );
        })}
        {showAssignedToMe && (
          <button
            type="button"
            aria-pressed={!!value.assignedToMe}
            onClick={() =>
              onChange({ ...value, assignedToMe: value.assignedToMe ? undefined : true, page: 1 })
            }
            className={cn(
              'h-8 cursor-pointer rounded-full border px-3 text-sm transition-colors',
              value.assignedToMe
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            Assignées à moi
          </button>
        )}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              onChange({ sort: value.sort, order: value.order, page: 1 });
            }}
          >
            <X className="size-4" /> Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
