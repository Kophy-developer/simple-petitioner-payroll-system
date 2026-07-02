import { cn } from "@/lib/cn";

type Tone = "default" | "success" | "warning" | "danger" | "navy";

const tones: Record<Tone, string> = {
  default: "bg-ink/5 text-ink/80",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  navy: "bg-civic-navy/10 text-civic-navy",
};

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
