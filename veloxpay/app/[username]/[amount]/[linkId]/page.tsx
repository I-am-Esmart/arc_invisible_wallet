import { notFound } from "next/navigation";
import { PaymentLinkCard } from "@/components/payment/payment-link-card";
import { getPaymentLinkByRoute } from "@/lib/api/payment-links";
import { payForPaymentLink } from "../actions";

type PaymentLinkPageProps = {
  params: Promise<{
    username: string;
    amount: string;
    linkId: string;
  }>;
  searchParams: Promise<{
    k?: string;
  }>;
};

export default async function PaymentLinkWithCodePage({ params, searchParams }: PaymentLinkPageProps) {
  const { username, amount, linkId } = await params;
  const { k } = await searchParams;

  const paymentLink = await getPaymentLinkByRoute(username, amount, linkId, k);

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
