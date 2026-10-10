import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold', className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Check className="size-5" strokeWidth={3} aria-hidden />
      </span>
      {!compact && <span className="text-lg tracking-tight">TaskFlow</span>}
    </span>
  );
}
