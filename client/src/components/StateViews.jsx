import { Inbox, AlertTriangle, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink-faint">
      <Loader2 size={22} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-black/5 text-ink-faint">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-sm text-ink-faint">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle size={22} />
      </div>
      <p className="text-sm font-medium text-ink">{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
