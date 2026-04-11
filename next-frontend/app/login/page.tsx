import { Suspense } from "react";
import { LoginPageClient } from "@/components/wallet/login-page-client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading wallet login...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
