"use client";

import { useCallback, useEffect, useState } from "react";
import type { PricingRule, RideType } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = Record<string, Partial<PricingRule>>;

const FIELDS: { key: keyof PricingRule; label: string; step?: string }[] = [
  { key: "baseFare", label: "Base fare" },
  { key: "perKm", label: "Per km" },
  { key: "perMinute", label: "Per minute" },
  { key: "minimumFare", label: "Minimum fare" },
  { key: "bookingFee", label: "Booking fee" },
  { key: "cancellationFee", label: "Cancellation fee" },
  { key: "surgeMultiplier", label: "Surge ×", step: "0.05" },
  { key: "commissionPct", label: "Commission %", step: "0.5" },
];

/** Pricing management: one editable card per ride type; saves create a new rule version. */
export default function AdminPricingPage() {
  const [types, setTypes] = useState<RideType[]>([]);
  const [rules, setRules] = useState<Record<string, PricingRule>>({});
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { pricing } = repos();
    const [typeList, ruleList] = await Promise.all([pricing.listRideTypes(), pricing.listRules()]);
    setTypes(typeList);
    const byType: Record<string, PricingRule> = {};
    // listRules is newest-first; keep the first (active) per ride type.
    for (const rule of ruleList) byType[rule.rideTypeId] ??= rule;
    setRules(byType);
    setDraft({});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField(typeId: string, key: keyof PricingRule, value: number) {
    setDraft((d) => ({ ...d, [typeId]: { ...d[typeId], [key]: value } }));
  }

  async function save(type: RideType) {
    const current = rules[type.id];
    if (!current) return;
    setSaving(type.id);
    try {
      await repos().pricing.upsertRule({ ...current, ...draft[type.id] });
      await load();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Pricing Management</h1>
      <p className="text-body-md text-on-surface-variant">
        Saving publishes a new active rule version — history is preserved for audits.
      </p>

      <div className="grid gap-6 xl:grid-cols-3">
        {types.map((type) => {
          const rule = rules[type.id];
          if (!rule) return null;
          const dirty = Boolean(draft[type.id] && Object.keys(draft[type.id]!).length);
          return (
            <Card key={type.id}>
              <CardHeader>
                <CardTitle>{type.displayName}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {FIELDS.map(({ key, label, step }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label className="whitespace-nowrap text-label-sm">{label}</Label>
                    <Input
                      type="number"
                      step={step ?? "0.1"}
                      className="h-10 max-w-28 text-right"
                      value={(draft[type.id]?.[key] as number | undefined) ?? (rule[key] as number)}
                      onChange={(e) => setField(type.id, key, Number(e.target.value))}
                    />
                  </div>
                ))}
                <Button className="mt-2" onClick={() => save(type)} disabled={!dirty || saving === type.id}>
                  {saving === type.id ? "Publishing…" : "Publish new rule"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
