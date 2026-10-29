import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type StateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** Empty list / first-run state. */
export function EmptyState({ icon, title, description, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-lg border border-line bg-surface text-center", className)}>
      <div className="flex flex-col items-center gap-3 px-6 py-8">
        {icon && (
          <div className="flex size-12 items-center justify-center rounded-full bg-cream text-primary [&_svg]:size-6">{icon}</div>
        )}
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Failed load / action. `action` is usually a retry button. */
export function ErrorState({ icon, title, description, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 rounded-lg border border-danger/20 bg-danger-soft px-6 py-8 text-center", className)}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-surface text-danger [&_svg]:size-7">
        {icon ?? <AlertTriangle />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
