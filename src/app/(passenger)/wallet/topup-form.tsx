"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/** Stripe Payment Element bound to a wallet top-up PaymentIntent. */
export function StripeTopupForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { variables: { colorPrimary: "#00c853", borderRadius: "16px" } } }}
    >
      <CheckoutInner />
    </Elements>
  );
}

function CheckoutInner() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/wallet` },
    });
    // On success Stripe redirects; the webhook credits the wallet.
    if (error) setError(error.message ?? "Payment failed");
    setSubmitting(false);
  }

  return (
    <form onSubmit={pay} className="flex flex-col gap-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="rounded-2xl bg-error-container px-4 py-2 text-label-sm text-on-error-container">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!stripe || submitting}>
        {submitting ? <Loader2 className="animate-spin" /> : "Pay"}
      </Button>
    </form>
  );
}
