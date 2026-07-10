"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportKind = "rides" | "payments" | "driver_earnings";

const REPORTS: { kind: ReportKind; title: string; description: string }[] = [
  { kind: "rides", title: "Rides report", description: "Every ride with status, fares and timestamps." },
  { kind: "payments", title: "Payments report", description: "All payment records incl. method and Stripe ids." },
  { kind: "driver_earnings", title: "Driver earnings", description: "Per-ride driver earnings and platform fees." },
];

/** Reports: date-ranged CSV exports generated client-side from admin queries. */
export default function AdminReportsPage() {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [running, setRunning] = useState<ReportKind | null>(null);

  async function download(kind: ReportKind) {
    setRunning(kind);
    try {
      const db = createClient();
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(new Date(to).getTime() + 86400_000).toISOString();

      /* eslint-disable @typescript-eslint/no-explicit-any */
      let rows: Record<string, any>[] = [];
      if (kind === "rides") {
        const { data } = await db
          .from("rides")
          .select("id, status, pickup_address, dropoff_address, estimated_fare, final_fare, payment_method, requested_at, completed_at")
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .order("created_at");
        rows = data ?? [];
      } else if (kind === "payments") {
        const { data } = await db
          .from("payments")
          .select("id, ride_id, method, status, amount, currency, stripe_payment_intent_id, created_at")
          .gte("created_at", fromIso)
          .lt("created_at", toIso)
          .order("created_at");
        rows = data ?? [];
      } else {
        const { data } = await db
          .from("rides")
          .select("id, driver_id, final_fare, driver_earnings, platform_fee, completed_at")
          .eq("status", "completed")
          .gte("completed_at", fromIso)
          .lt("completed_at", toIso)
          .order("completed_at");
        rows = data ?? [];
      }

      const csv = toCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voygo-${kind}-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Reports</h1>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-6">
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map(({ kind, title, description }) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-body-lg font-semibold">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => download(kind)} disabled={running !== null}>
                {running === kind ? <Loader2 className="animate-spin" /> : <Download />}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "no data";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
