import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PaymentLinkNotFound() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <h1 className="text-2xl font-semibold text-slate-900">Payment link not found</h1>
      <p className="mt-3 text-sm text-slate-600">
        This payment request may have been removed, expired, or the URL is incorrect.
      </p>
      <div className="mt-6">
        <Button asChild variant="secondary">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
