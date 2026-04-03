import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Payment } from "@/lib/types/payment";
import { formatDate, formatMoney } from "@/lib/utils/format";

export function PaymentsTable({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
      <p className="mt-1 text-sm text-slate-600">
        Recent incoming payments collected through payment links.
      </p>

      {payments.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500">
          No payments yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr className="text-slate-500">
                <th className="py-3 pr-6 font-medium">Payment</th>
                <th className="py-3 pr-6 font-medium">Amount</th>
                <th className="py-3 pr-6 font-medium">Status</th>
                <th className="py-3 pr-6 font-medium">Transaction</th>
                <th className="py-3 font-medium">Paid at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="py-4 pr-6 text-slate-900">{payment.linkLabel || payment.linkId}</td>
                  <td className="py-4 pr-6 text-slate-700">
                    {formatMoney(payment.amount, payment.currency)}
                  </td>
                  <td className="py-4 pr-6">
                    <Badge
                      variant={
                        payment.status === "completed"
                          ? "success"
                          : payment.status === "failed"
                            ? "error"
                            : "warning"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="py-4 pr-6 text-slate-500">
                    {payment.transactionHash ? (
                      <span className="font-mono text-xs">{payment.transactionHash}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-4 text-slate-500">{formatDate(payment.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
