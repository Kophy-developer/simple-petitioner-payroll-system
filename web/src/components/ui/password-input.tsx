"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

export function PasswordInput({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(
          "w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-2.5 pr-11 text-sm text-ink outline-none transition placeholder:text-ink/40 focus:border-brass focus:ring-2 focus:ring-brass/20",
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-ink/45 transition hover:bg-ink/5 hover:text-ink"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
