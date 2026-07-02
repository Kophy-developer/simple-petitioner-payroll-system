import Image from "next/image";
import Link from "next/link";

const screens = [
  { href: "/submissions", label: "Circulator Submission", roles: "Circulator" },
  { href: "/collection", label: "Master Collection Table", roles: "Admin+" },
  { href: "/reports", label: "Issue Report", roles: "Admin+" },
  { href: "/directory", label: "Employee Directory", roles: "Admin+" },
  { href: "/ledger", label: "Circulator Ledger", roles: "All roles" },
  { href: "/pay-table", label: "Petition Pay Table", roles: "Super Admin" },
  { href: "/validity", label: "Validity Upload", roles: "Admin+" },
  { href: "/pay-rates", label: "Pay Rate Config", roles: "Super Admin" },
  { href: "/payroll", label: "Payroll & Expenses", roles: "Circulator+" },
  { href: "/loans", label: "Loan / Advance", roles: "Circulator / Super Admin" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-ink/10 bg-ink text-parchment">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <div className="flex items-center gap-4">
            <Image
              src="/brand/logo.svg"
              alt="Ballot Access Pros"
              width={56}
              height={56}
              className="rounded-md bg-parchment p-2"
              priority
            />
            <div>
              <p className="font-display text-sm tracking-[0.35em] uppercase">
                Ballot Access
              </p>
              <p className="font-display text-2xl tracking-[0.2em] uppercase">
                Pros
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink transition hover:brightness-110"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-12">
        <section className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-civic-navy">
            Phase 1 scaffold
          </p>
          <h1 className="font-display text-4xl text-ink sm:text-5xl">
            Circulator Management & Payroll
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-ink/75">
            Web shell is live. Supabase schema, payroll regression tests, and
            deployment wiring are in place. Next up: auth screens, then feature
            routes below.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {screens.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-2xl border border-ink/10 bg-white/70 p-5 transition hover:border-brass hover:shadow-sm"
            >
              <p className="font-display text-xl text-ink">{screen.label}</p>
              <p className="mt-2 text-sm text-ink/60">{screen.roles}</p>
            </Link>
          ))}
        </section>

        <section className="rounded-2xl border border-civic-navy/15 bg-civic-navy/5 p-6">
          <h2 className="font-display text-2xl text-civic-navy">Stack</h2>
          <ul className="mt-4 grid gap-2 text-sm text-ink/80 sm:grid-cols-2">
            <li>Next.js web app in `web/`</li>
            <li>Supabase Postgres + Auth + Storage</li>
            <li>Payroll logic tested in `web/src/lib/payroll.test.ts`</li>
            <li>Vercel deploy root: `web`</li>
            <li>Flutter client folder reserved for Phase 2</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
