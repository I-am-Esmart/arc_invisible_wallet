import { notFound } from "next/navigation";
import { PaymentLinkCard } from "@/components/payment/payment-link-card";
import { getPaymentLinkByRoute } from "@/lib/api/payment-links";
import { payForPaymentLink } from "./actions";

type PaymentLinkPageProps = {
  params: Promise<{
    username: string;
    amount: string;
  }>;
};

export default async function PaymentLinkPage({ params }: PaymentLinkPageProps) {
  const { username, amount } = await params;

  const paymentLink = await getPaymentLinkByRoute(username, amount);

  if (!paymentLink) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl">
      <PaymentLinkCard
        paymentLink={paymentLink}
        payAction={payForPaymentLink.bind(null, paymentLink.linkCode || paymentLink.id)}
      />
    </main>
  );
}
