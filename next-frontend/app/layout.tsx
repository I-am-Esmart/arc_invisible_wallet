import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeloxPay",
  description: "Create a wallet, send and receive USDC or EURC, and manage payment links from one simple VeloxPay workspace.",
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
            <AppHeader />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
