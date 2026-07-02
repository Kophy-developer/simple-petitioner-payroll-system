import Link from "next/link";

export function PlaceholderScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div>
        <p className="text-sm uppercase tracking-[0.25em] text-civic-navy">
          Coming next
        </p>
        <h1 className="mt-3 font-display text-4xl text-ink">{title}</h1>
        <p className="mt-4 text-base leading-7 text-ink/70">{description}</p>
      </div>
      <Link
        href="/"
        className="inline-flex w-fit rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink"
      >
        Back home
      </Link>
    </div>
  );
}
