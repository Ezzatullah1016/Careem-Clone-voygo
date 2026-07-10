"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { WalletTransaction } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

/** Earnings dashboard: 7-day bar chart + totals from the wallet ledger. */
export default function EarningsPage() {
  const { user } = useAuth();
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void repos()
      .wallets.transactions(user.id)
      .then((page) => {
        setTxs(page.items.filter((tx) => tx.type === "ride_earning"));
        setLoading(false);
      });
  }, [user]);

  const { chartData, todayTotal, weekTotal, allTotal } = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    const chartData = days.map((d) => ({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      total: txs
        .filter((tx) => new Date(tx.createdAt).toDateString() === d.toDateString())
        .reduce((sum, tx) => sum + tx.amount, 0),
    }));
    const today = new Date().toDateString();
    return {
      chartData,
      todayTotal: txs
        .filter((tx) => new Date(tx.createdAt).toDateString() === today)
        .reduce((s, tx) => s + tx.amount, 0),
      weekTotal: chartData.reduce((s, d) => s + d.total, 0),
      allTotal: txs.reduce((s, tx) => s + tx.amount, 0),
    };
  }, [txs]);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Earnings" backHref="/driver" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Today" value={todayTotal} loading={loading} />
          <StatTile label="This week" value={weekTotal} loading={loading} />
          <StatTile label="All time" value={allTotal} loading={loading} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={44} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v)}
                    cursor={{ fill: "rgba(0,200,83,0.08)" }}
                  />
                  <Bar dataKey="total" fill="#00c853" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent payouts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-black/5">
            {txs.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-label-md text-on-surface">{tx.description ?? "Ride earnings"}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-label-md font-bold text-primary">+{formatCurrency(tx.amount)}</p>
              </div>
            ))}
            {!loading && txs.length === 0 && (
              <p className="py-6 text-center text-body-md text-on-surface-variant">
                Complete rides to see earnings here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function StatTile({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-label-sm uppercase tracking-wider text-on-surface-variant">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-body-lg font-bold text-on-surface">{formatCurrency(value)}</p>
        )}
      </CardContent>
    </Card>
  );
}
