import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BUILDER_X_URL = process.env.NEXT_PUBLIC_BUILDER_X_URL || "https://x.com/cryptosmart121";

function XLogo() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M18.901 1.154H22.58l-8.04 9.188L24 22.846h-7.406l-5.8-7.584-6.637 7.584H.476l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932Zm-1.291 19.49h2.039L6.486 3.248H4.298L17.61 20.644Z" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="space-y-10 pb-10">
      <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_45%,_#eef5ff)] p-8 shadow-sm ring-1 ring-slate-200 sm:p-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-brand-50 px-4 py-1 text-sm font-medium tracking-[0.18em] text-brand-700 uppercase">
              VeloxPay
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Share a payment link. Get paid without the usual friction.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Create a simple link, send it to anyone, and let them pay in a clean,
              familiar flow. No confusing setup screen. No clutter. Just a fast way to
              collect money.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/create">Create payment link</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <div>
                <div className="font-semibold text-slate-900">Fast checkout</div>
                <div>Make it easy for people to pay you.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Shareable links</div>
                <div>Perfect for DMs, bios, invoices, and posts.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-900">Clear tracking</div>
                <div>See links created and payments received in one place.</div>
              </div>
            </div>
          </div>

          <Card className="border border-white/70 bg-white/85 p-7 backdrop-blur">
            <div className="rounded-2xl bg-slate-950 p-5 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-white/70">
                Example payment link
              </div>
              <div className="mt-3 break-all text-lg font-medium">
                veloxpay.vercel.app/smart/500/a1b2c3d4
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="text-sm text-slate-500">Amount</div>
                <div className="mt-1 text-3xl font-semibold text-slate-950">500 USDC</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">What the payer sees</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  A clean page with who they are paying, the amount, and one clear pay
                  button.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">1. Create a link</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Add an amount and a short note, then generate a link in seconds.
          </p>
        </Card>
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">2. Share it anywhere</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Drop it in chats, social posts, invoices, or directly to a customer.
          </p>
        </Card>
        <Card className="bg-white/90">
          <h2 className="text-lg font-semibold text-slate-900">3. Track payments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Keep an eye on every payment from your dashboard without extra steps.
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Built for simple payments</h2>
          <p className="mt-2 text-sm text-slate-600">
            VeloxPay keeps the payment experience clear and friendly from start to finish.
          </p>
        </div>
        <a
          href={BUILDER_X_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <XLogo />
          built by smart
        </a>
      </section>
    </main>
  );
}
