import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

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
      <body className={`${inter.variable} ${manrope.variable} font-sans`}>
        <div className="min-h-screen">
          <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
            <AppHeader />
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
