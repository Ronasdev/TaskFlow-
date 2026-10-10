import { Eye, Shield, ShieldCheck, User } from 'lucide-react';
import { Badge } from '@/components/ui/display';
import type { ProjectRole } from '@/types/api';
import { ROLE_LABELS } from '../permissions';

const ICONS = { OWNER: ShieldCheck, ADMIN: Shield, MEMBER: User, VIEWER: Eye } as const;

export function RoleBadge({ role }: { role: ProjectRole }) {
  const Icon = ICONS[role];
  return (
    <Badge
      className={role === 'VIEWER' ? 'bg-surface-muted text-muted' : 'bg-primary-soft text-primary'}
    >
      <Icon className="size-3.5" aria-hidden />
      {role === 'VIEWER' ? 'Lecture seule' : ROLE_LABELS[role]}
    </Badge>
  );
}
