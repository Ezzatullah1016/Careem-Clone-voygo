"use client";

import { useCallback, useEffect, useState } from "react";
import type { Payment } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

const STATUS_FILTERS = [undefined, "captured", "pending", "failed", "refunded"] as const;

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  captured: "success",
  authorized: "warning",
  pending: "warning",
  failed: "destructive",
  refunded: "secondary",
};

/** Payment oversight: all transactions with status filter + paging. */
export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const result = await repos().payments.listAll({ status, page });
    setPayments(result.items);
    setTotal(result.total);
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Payments</h1>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s ?? "all"}
            size="sm"
            variant={status === s ? "default" : "secondary"}
            onClick={() => {
              setStatus(s);
              setPage(0);
            }}
            className="capitalize"
          >
            {s ?? "All"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe Intent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="capitalize">{p.method}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(p.amount, p.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-label-sm text-on-surface-variant">
                    {p.stripePaymentIntentId ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-label-sm text-on-surface-variant">{total} payments</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={(page + 1) * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
