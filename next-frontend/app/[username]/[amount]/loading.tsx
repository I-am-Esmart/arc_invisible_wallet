export default function PaymentLinkLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-6 h-10 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 h-12 w-full animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}
