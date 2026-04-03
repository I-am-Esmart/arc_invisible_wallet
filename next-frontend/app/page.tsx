import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="space-y-8">
      <section className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">
          Arc Payment Links
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900">
          Share a link. Get paid in stablecoins without exposing wallet complexity.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          This Next.js frontend plugs into your existing Node.js invisible-wallet backend
          for payment-link creation, payment collection, and payment tracking.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/create">Create Link</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Public payment page</h2>
          <p className="mt-2 text-sm text-slate-600">
            Friendly pay page at routes like <code>/emmanuel/500</code>.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Backend-first</h2>
          <p className="mt-2 text-sm text-slate-600">
            Wallets and blockchain execution remain in the existing Node backend.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Simple UX</h2>
          <p className="mt-2 text-sm text-slate-600">
            Users just see who they are paying, how much, and one clear action.
          </p>
        </Card>
      </section>
    </main>
  );
}
