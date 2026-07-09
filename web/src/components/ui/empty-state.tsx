import Link from "next/link";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 px-6 py-12 text-center">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/60">{description}</p>
      {action ? (
        <Link
          href={action.href}
          className={cn(
            "mt-6 inline-flex rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink transition hover:brightness-105",
          )}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
