import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

/** A public link with copy + open actions. */
export function LinkRow({
  title,
  hint,
  url,
  label,
  copyLabel,
  copiedLabel,
  openLabel,
}: {
  title: string;
  hint?: string;
  url: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
  openLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="flex min-h-11 flex-1 items-center truncate rounded-md border border-line bg-sand px-3 text-sm">
          {label}
        </code>
        <CopyButton value={url} label={copyLabel} copiedLabel={copiedLabel} iconOnly />
        <Button asChild variant="secondary" size="icon" aria-label={openLabel}>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
          </a>
        </Button>
      </div>
    </div>
  );
}
