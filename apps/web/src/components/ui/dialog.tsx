import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `sheet` : panneau latéral (plein écran sur mobile). */
  variant?: 'center' | 'sheet';
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  variant = 'center',
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-2xl focus:outline-none',
            variant === 'center' &&
              'animate-panel-in inset-x-4 top-1/2 max-h-[90dvh] -translate-y-1/2 rounded-2xl border border-border sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2',
            variant === 'sheet' &&
              'animate-sheet-in inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-xl sm:border-l sm:border-border',
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-0.5 text-sm text-muted">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              className="-mr-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              aria-label="Fermer"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ confirmLabel, onConfirm, loading, ...props }: ConfirmDialogProps) {
  return (
    <Dialog
      {...props}
      footer={
        <>
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            Annuler
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{props.description}</p>
    </Dialog>
  );
}
