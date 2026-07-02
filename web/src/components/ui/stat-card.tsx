import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueTone =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : "text-ink";

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/75 p-5">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink/50">
        {label}
      </p>
      <p className={cn("mt-2 font-display text-3xl tabular-nums", valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm text-ink/60">{hint}</p> : null}
    </div>
  );
}
