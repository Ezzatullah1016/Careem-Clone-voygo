"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { PromoCode } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

/** Coupon management: create percentage/fixed promos, deactivate live ones. */
export default function AdminCouponsPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    description: "",
    kind: "pct" as "pct" | "amount",
    value: 10,
    maxDiscount: 10,
    minFare: 0,
    usageLimit: 100,
    perUserLimit: 1,
    validUntil: "",
  });

  const load = useCallback(async () => {
    setPromos(await repos().promos.list());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await repos().promos.upsert({
      code: form.code,
      description: form.description || null,
      discountPct: form.kind === "pct" ? form.value : null,
      discountAmount: form.kind === "amount" ? form.value : null,
      maxDiscount: form.kind === "pct" ? form.maxDiscount : null,
      minFare: form.minFare,
      usageLimit: form.usageLimit || null,
      perUserLimit: form.perUserLimit,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      isActive: true,
    });
    setOpen(false);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg text-on-surface">Coupons</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> New coupon
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create coupon</DialogTitle>
            </DialogHeader>
            <form onSubmit={create} className="flex flex-col gap-3">
              <Label>Code</Label>
              <Input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME10"
                className="uppercase"
              />
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={form.kind === "pct" ? "default" : "secondary"}
                      onClick={() => setForm({ ...form, kind: "pct" })}
                    >
                      % off
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={form.kind === "amount" ? "default" : "secondary"}
                      onClick={() => setForm({ ...form, kind: "amount" })}
                    >
                      $ off
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>{form.kind === "pct" ? "Percent" : "Amount"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  />
                </div>
                {form.kind === "pct" && (
                  <div>
                    <Label>Max discount ($)</Label>
                    <Input
                      type="number"
                      value={form.maxDiscount}
                      onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div>
                  <Label>Min fare ($)</Label>
                  <Input
                    type="number"
                    value={form.minFare}
                    onChange={(e) => setForm({ ...form, minFare: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Total uses</Label>
                  <Input
                    type="number"
                    value={form.usageLimit}
                    onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Per-user uses</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.perUserLimit}
                    onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>Valid until</Label>
                  <Input
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="mt-2">
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min fare</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Badge>{p.code}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.discountPct != null
                      ? `${p.discountPct}%${p.maxDiscount ? ` (max ${formatCurrency(p.maxDiscount)})` : ""}`
                      : formatCurrency(p.discountAmount ?? 0)}
                  </TableCell>
                  <TableCell>{formatCurrency(p.minFare)}</TableCell>
                  <TableCell>{p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "∞"}</TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "destructive"}>
                      {p.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.isActive && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          await repos().promos.deactivate(p.id);
                          void load();
                        }}
                      >
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
