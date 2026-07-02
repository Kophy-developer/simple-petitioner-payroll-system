import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <Card className="w-full max-w-md">
      <CardBody className="space-y-6 text-center">
        <Image
          src="/brand/logo.svg"
          alt="Ballot Access Pros"
          width={56}
          height={56}
          className="mx-auto rounded-xl bg-ink p-2"
        />
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-civic-navy">
            Account recovery
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">
            Reset password
          </h1>
          <p className="mt-3 text-sm leading-7 text-ink/65">
            Password reset will connect to Supabase Auth in the next backend
            pass. For the demo, use <span className="font-mono">demo1234</span>.
          </p>
        </div>
        <Link href="/login">
          <Button variant="secondary" className="w-full">
            Back to sign in
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
}
