import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-ink/10 bg-white/80 p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.25em] text-civic-navy">
          Authentication
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">Sign in</h1>
        <p className="mt-3 text-sm leading-7 text-ink/70">
          Supabase Auth wiring comes next. Connect your Supabase project env
          vars locally and on Vercel to enable email login.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-brass px-5 py-2 text-sm font-medium text-ink"
        >
          Back to dashboard shell
        </Link>
      </div>
    </div>
  );
}
