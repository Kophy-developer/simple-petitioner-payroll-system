"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={cn(
          "relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-ink/10 bg-parchment shadow-xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between border-b border-ink/10 px-6 py-4">
          <h2 className="font-display text-xl text-ink">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </Button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
