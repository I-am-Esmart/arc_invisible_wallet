import { notFound } from "next/navigation";
import { PaymentLinkCard } from "@/components/payment/payment-link-card";
import { getPaymentLinkByRoute } from "@/lib/api/payment-links";
import { payForPaymentLink } from "@/app/[username]/[amount]/actions";

type PaymentLinkByIdPageProps = {
  params: Promise<{
    linkId: string;
  }>;
};

export default async function PaymentLinkByIdPage({ params }: PaymentLinkByIdPageProps) {
  const { linkId } = await params;
  const paymentLink = await getPaymentLinkByRoute(undefined, undefined, linkId);

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
