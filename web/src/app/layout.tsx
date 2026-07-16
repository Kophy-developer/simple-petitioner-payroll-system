import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { DemoSessionProvider } from "@/lib/demo-session";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ballot Access Pros",
  description: "Circulator management and payroll platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-parchment text-ink" suppressHydrationWarning>
        <DemoSessionProvider>{children}</DemoSessionProvider>
      </body>
    </html>
  );
}
