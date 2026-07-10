"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { Wallet, WalletTransaction } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

/** Driver wallet: balance (accrued earnings pending payout) + full ledger. */
export default function DriverWalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const { wallets } = repos();
    void Promise.all([wallets.getForUser(user.id), wallets.transactions(user.id)]).then(([w, t]) => {
      setWallet(w);
      setTxs(t.items);
      setLoading(false);
    });
  }, [user]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Wallet" backHref="/driver" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        <Card className="bg-gradient-to-br from-primary-container/90 to-primary/90 text-white">
          <CardContent className="p-6">
            <p className="text-label-md uppercase tracking-widest text-white/80">Available balance</p>
            {loading ? (
              <Skeleton className="mt-2 h-12 w-40 bg-white/20" />
            ) : (
              <p className="mt-1 text-display-lg">{formatCurrency(wallet?.balance ?? 0, wallet?.currency)}</p>
            )}
            <p className="mt-2 text-label-sm text-white/70">
              Payouts are transferred to your bank weekly.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col divide-y divide-black/5 p-2">
            {!loading && txs.length === 0 && (
              <p className="p-6 text-center text-body-md text-on-surface-variant">No transactions yet.</p>
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
                      {tx.description ?? tx.type.replaceAll("_", " ")}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {new Date(tx.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className={credit ? "text-label-md font-bold text-primary" : "text-label-md font-bold"}>
                    {credit ? "+" : ""}
                    {formatCurrency(tx.amount)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
