import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Clock3, FolderKanban, LayoutPanelTop, ShieldCheck } from "lucide-react";

type ModulePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  status: string;
  primaryMetric: string;
  primaryLabel: string;
  secondaryMetric: string;
  secondaryLabel: string;
  icon: LucideIcon;
};

export default function ModulePlaceholder({
  eyebrow,
  title,
  description,
  status,
  primaryMetric,
  primaryLabel,
  secondaryMetric,
  secondaryLabel,
  icon: Icon,
}: ModulePlaceholderProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-3xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-6 md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Icon size={14} />
            <span>{eyebrow}</span>
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 md:px-8 md:py-8">
          <div className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Status</p>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Live</span>
            </div>
            <p className="mt-5 text-xl font-semibold tracking-tight text-foreground">{status}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The structure is now in place for live data, analyst workflows, and production-ready views.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <p className="text-sm font-medium text-foreground">Planned modules</p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="inline-flex items-center gap-2"><LayoutPanelTop size={16} /> Executive view</span>
                <ArrowUpRight size={16} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="inline-flex items-center gap-2"><FolderKanban size={16} /> Work queues</span>
                <ArrowUpRight size={16} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-4 py-3">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} /> Review controls</span>
                <ArrowUpRight size={16} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium text-foreground">Workspace metrics</p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-muted/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">{primaryLabel}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{primaryMetric}</p>
            </div>
            <div className="rounded-xl bg-muted/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">{secondaryLabel}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{secondaryMetric}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 size={16} />
            Next rollout
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This page is ready to swap from placeholder content to live tables, approvals, and investigation flows.
          </p>
        </div>
      </aside>
    </div>
  );
}
