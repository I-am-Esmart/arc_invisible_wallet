import type { PaymentTimelineEvent } from "@/lib/types/payment-link";
import { formatDate } from "@/lib/utils/format";

export function PaymentTimeline({
  timeline,
}: {
  timeline?: PaymentTimelineEvent[];
}) {
  if (!timeline?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((event, index) => (
        <div key={event.id || `${event.status}-${event.at}-${index}`} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-brand-600" />
            {index < timeline.length - 1 ? <div className="mt-1 h-10 w-px bg-slate-200" /> : null}
          </div>
          <div className="min-w-0 flex-1 rounded-2xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{event.label}</p>
              <p className="text-xs text-slate-500">{formatDate(event.at)}</p>
            </div>
            {event.details ? <p className="mt-1 text-sm text-slate-600">{event.details}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
