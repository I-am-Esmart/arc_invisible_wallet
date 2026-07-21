import { notFound } from "next/navigation";
import { PaymentLinkCard } from "@/components/payment/payment-link-card";
import { getPaymentLinkByRoute } from "@/lib/api/payment-links";
import { getSmartRequestByPaymentLinkId } from "@/lib/api/smart-requests";
import { payForPaymentLink } from "@/app/[username]/[amount]/actions";

type PaymentLinkByIdPageProps = {
  params: Promise<{
    linkId: string;
  }>;
  searchParams: Promise<{
    k?: string;
  }>;
};

export default async function PaymentLinkByIdPage({ params, searchParams }: PaymentLinkByIdPageProps) {
  const { linkId } = await params;
  const { k } = await searchParams;
  const paymentLink = await getPaymentLinkByRoute(undefined, undefined, linkId, k);

  if (!paymentLink) {
    notFound();
  }
  const smartRequest = await getSmartRequestByPaymentLinkId(paymentLink.id)
    .then((response) => response.smartRequest)
    .catch(() => null);

  return (
    <main className="mx-auto max-w-2xl">
      <PaymentLinkCard
        paymentLink={paymentLink}
        payAction={payForPaymentLink.bind(null, paymentLink.linkCode || paymentLink.id)}
        smartRequest={smartRequest}
      />
    </main>
  );
}
