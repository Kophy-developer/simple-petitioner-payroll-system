import { cn } from "@/lib/cn";

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-ink/10", className)}>
      <table className="min-w-full divide-y divide-ink/10 text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "bg-ink/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink/55",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  highlight,
}: {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  highlight?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-ink/85",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        highlight && "bg-brass/5 font-medium text-ink",
        className,
      )}
    >
      {children}
    </td>
  );
}
