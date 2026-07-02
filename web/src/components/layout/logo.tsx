import Image from "next/image";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <Image
        src="/brand/logo.svg"
        alt="Ballot Access Pros"
        width={compact ? 40 : 48}
        height={compact ? 40 : 48}
        className="rounded-lg bg-parchment p-1.5"
      />
      {!compact ? (
        <div className="hidden sm:block">
          <p className="font-display text-[10px] tracking-[0.35em] text-parchment/80 uppercase">
            Ballot Access
          </p>
          <p className="font-display text-xl tracking-[0.18em] text-parchment uppercase">
            Pros
          </p>
        </div>
      ) : null}
    </Link>
  );
}
