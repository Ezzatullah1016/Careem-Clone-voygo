"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus } from "lucide-react";
import type { Wallet, WalletTransaction } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { StripeTopupForm } from "./topup-form";

/** Wallet: emerald balance card, Stripe top-up, ledger list. */
export default function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(25);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    const { wallets } = repos();
    void Promise.all([wallets.getForUser(user.id), wallets.transactions(user.id)]).then(
      ([w, t]) => {
        setWallet(w);
        setTxs(t.items);
        setLoading(false);
      }
    );
  }, [user]);

  const [topupError, setTopupError] = useState<string | null>(null);

  async function startTopup() {
    setCreating(true);
    setTopupError(null);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.clientSecret) {
        setTopupError("Payments unavailable — Stripe keys not configured yet.");
        return;
      }
      setClientSecret(json.clientSecret);
    } catch {
      setTopupError("Payments unavailable — Stripe keys not configured yet.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Wallet" backHref="/home" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        {/* Balance card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden bg-gradient-to-br from-primary-container/90 to-primary/90 text-white">
            <CardContent className="p-6">
              <p className="text-label-md uppercase tracking-widest text-white/80">Balance</p>
              {loading ? (
                <Skeleton className="mt-2 h-12 w-40 bg-white/20" />
              ) : (
                <p className="mt-1 text-display-lg">
                  {formatCurrency(wallet?.balance ?? 0, wallet?.currency)}
                </p>
              )}
              <Dialog onOpenChange={(open) => !open && setClientSecret(null)}>
                <DialogTrigger asChild>
                  <Button variant="glass" className="mt-4 text-white">
                    <Plus /> Top up
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Top up wallet</DialogTitle>
                  </DialogHeader>
                  {!clientSecret ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex gap-2">
                        {[10, 25, 50, 100].map((preset) => (
                          <Button
                            key={preset}
                            variant={amount === preset ? "default" : "secondary"}
                            size="sm"
                            onClick={() => setAmount(preset)}
                          >
                            ${preset}
                          </Button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        min={5}
                        max={1000}
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                      />
                      <Button onClick={startTopup} disabled={creating || amount < 5}>
                        {creating ? <Loader2 className="animate-spin" /> : `Continue — $${amount}`}
                      </Button>
                      {topupError && (
                        <p role="alert" className="rounded-2xl bg-error-container px-4 py-2 text-label-sm text-on-error-container">
                          {topupError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <StripeTopupForm clientSecret={clientSecret} />
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </motion.div>

        {/* Ledger */}
        <section>
          <h2 className="mb-3 text-headline-md text-on-surface">Activity</h2>
          <Card>
            <CardContent className="flex flex-col divide-y divide-black/5 p-2">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-2 h-14" />)}
              {!loading && txs.length === 0 && (
                <p className="p-6 text-center text-body-md text-on-surface-variant">
                  No transactions yet.
                </p>
              )}
              {txs.map((tx) => {
                const credit = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center gap-4 p-4">
                    <span
                      className={
                        credit
                          ? "flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20 text-primary"
                          : "flex h-10 w-10 items-center justify-center rounded-full bg-error-container/60 text-on-error-container"
                      }
                    >
                      {credit ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md capitalize text-on-surface">
                        {tx.description ?? tx.type.replace("_", " ")}
                      </p>
                      <p className="text-label-sm text-on-surface-variant">
                        {new Date(tx.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p className={credit ? "text-label-md font-bold text-primary" : "text-label-md font-bold text-on-surface"}>
                      {credit ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
