import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeloxPay",
  description: "Create payment links, share them in seconds, and get paid with a simple checkout experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex justify-end">
              <ThemeToggle />
            </div>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
