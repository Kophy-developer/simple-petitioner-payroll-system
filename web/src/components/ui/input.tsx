import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-brass focus:ring-2 focus:ring-brass/20",
        className,
      )}
      {...props}
    />
  );
}
