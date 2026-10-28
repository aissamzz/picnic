import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { KabyleBand } from "./kabyle-band";

type StateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** Empty list / first-run state. Carries the brand band. */
export function EmptyState({ icon, title, description, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center overflow-hidden rounded-lg border border-line bg-surface text-center", className)}>
      <KabyleBand />
      <div className="flex flex-col items-center gap-3 px-6 py-8">
        {icon && (
          <div className="flex size-14 items-center justify-center rounded-full bg-sand text-clay [&_svg]:size-7">{icon}</div>
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
