import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope } from "next/font/google";
import { MotionConfig } from "framer-motion";
import { AppFooter } from "@/components/app-footer";
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
  metadataBase: new URL("https://www.useveloxpay.xyz"),
  title: "VeloxPay",
  description: "Create a wallet, send and receive USDC or EURC, and manage payment links from one simple VeloxPay workspace.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VeloxPay",
    description: "Programmable stablecoin payments for global teams.",
    url: "https://www.useveloxpay.xyz",
    siteName: "VeloxPay",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable} font-sans`}>
        <MotionConfig reducedMotion="user">
          <div className="min-h-screen">
            <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <AppHeader />
              {children}
              <AppFooter />
            </div>
          </div>
        </MotionConfig>
      </body>
    </html>
  );
}
