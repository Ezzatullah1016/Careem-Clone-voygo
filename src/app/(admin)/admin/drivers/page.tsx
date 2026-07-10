"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, XCircle } from "lucide-react";
import type { DriverProfile } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["pending", "approved", "rejected", "suspended"] as const;

/** Driver verification queue: review applications, approve/reject. */
export default function AdminDriversPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);

  const load = useCallback(async () => {
    const result = await repos().drivers.listByStatus(tab);
    setDrivers(result.items);
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(driver: DriverProfile, decision: "approved" | "rejected") {
    const reason =
      decision === "rejected" ? prompt("Rejection reason?") ?? undefined : undefined;
    await repos().drivers.review(driver.id, decision, reason);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Driver Verification</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Trips</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No {tab} drivers.
                  </TableCell>
                </TableRow>
              )}
              {drivers.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={d.profile?.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{(d.profile?.fullName ?? "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-label-md">{d.profile?.fullName ?? "—"}</p>
                        <p className="text-label-sm text-on-surface-variant">{d.profile?.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{d.licenseNumber ?? "—"}</TableCell>
                  <TableCell>{d.licenseExpiry ?? "—"}</TableCell>
                  <TableCell>{d.totalTrips}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        d.status === "approved" ? "success" : d.status === "pending" ? "warning" : "destructive"
                      }
                    >
                      {d.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {d.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => review(d, "approved")}>
                          <BadgeCheck /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => review(d, "rejected")}>
                          <XCircle /> Reject
                        </Button>
                      </div>
                    )}
                    {d.status === "approved" && (
                      <Button size="sm" variant="destructive" onClick={() => review(d, "rejected")}>
                        Suspend
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
