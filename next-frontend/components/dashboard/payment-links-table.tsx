import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaymentLink } from "@/lib/types/payment-link";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PaymentLinksTable({
  paymentLinks,
}: {
  paymentLinks: PaymentLink[];
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payment links</h2>
          <p className="mt-1 text-sm text-slate-600">
            All public links generated from the backend.
          </p>
        </div>
      </div>

      {paymentLinks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          No payment links yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="py-3 pr-6 font-medium">Link</th>
                <th className="py-3 pr-6 font-medium">Amount</th>
                <th className="py-3 pr-6 font-medium">Description</th>
                <th className="py-3 pr-6 font-medium">Status</th>
                <th className="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentLinks.map((link) => (
                <tr key={link.id}>
                  <td className="py-4 pr-6">
                    <Link href={`/${link.username}/${link.amount}`} className="font-medium text-slate-900">
                      /{link.username}/{link.amount}
                    </Link>
                  </td>
                  <td className="py-4 pr-6 text-slate-700">
                    {formatMoney(link.amount, link.currency)}
                  </td>
                  <td className="py-4 pr-6 text-slate-600">{link.description || "-"}</td>
                  <td className="py-4 pr-6">
                    <Badge variant={link.status === "active" ? "success" : "warning"}>
                      {link.status}
                    </Badge>
                  </td>
                  <td className="py-4 text-slate-500">{formatDate(link.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
