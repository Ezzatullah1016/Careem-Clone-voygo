"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, XCircle } from "lucide-react";
import type { Vehicle } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Vehicle approval queue. */
export default function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    const result = await repos().vehicles.listPending();
    setVehicles(result.items);
    setTotal(result.total);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(vehicle: Vehicle, decision: "approved" | "rejected") {
    const reason = decision === "rejected" ? prompt("Rejection reason?") ?? undefined : undefined;
    await repos().vehicles.review(vehicle.id, decision, reason);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-lg text-on-surface">Vehicle Approval</h1>
        <Badge variant="warning">{total} pending</Badge>
      </div>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Plate</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Color</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-on-surface-variant">
                    No vehicles awaiting review.
                  </TableCell>
                </TableRow>
              )}
              {vehicles.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-label-md">
                    {v.make} {v.model}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{v.plateNumber}</Badge>
                  </TableCell>
                  <TableCell>{v.year}</TableCell>
                  <TableCell>{v.color}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(v, "approved")}>
                        <BadgeCheck /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => review(v, "rejected")}>
                        <XCircle /> Reject
                      </Button>
                    </div>
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
