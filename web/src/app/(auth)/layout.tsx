export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(198,161,91,0.12),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(30,42,69,0.08),transparent_45%)]" />
      <div className="relative flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
