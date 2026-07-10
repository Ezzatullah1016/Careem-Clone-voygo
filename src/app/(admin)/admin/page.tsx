"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CarFront, CircleDollarSign, Route, Users } from "lucide-react";
import { createClient } from "@/infrastructure/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  totalRides: number;
  activeDrivers: number;
  totalUsers: number;
  monthlyRevenue: number;
  ridesByDay: { day: string; rides: number }[];
}

/** Admin analytics (voygo_admin_dashboard): KPI tiles + 14-day trend. */
export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const db = createClient();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const fourteenDaysAgo = new Date(Date.now() - 13 * 86400_000);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    void (async () => {
      const [rides, drivers, users, revenue, recent] = await Promise.all([
        db.from("rides").select("*", { count: "exact", head: true }),
        db.from("driver_profiles").select("*", { count: "exact", head: true }).eq("is_online", true),
        db.from("profiles").select("*", { count: "exact", head: true }),
        db
          .from("rides")
          .select("platform_fee")
          .eq("status", "completed")
          .gte("completed_at", monthStart.toISOString()),
        db
          .from("rides")
          .select("created_at")
          .gte("created_at", fourteenDaysAgo.toISOString()),
      ]);

      const ridesByDay = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(fourteenDaysAgo.getTime() + i * 86400_000);
        return {
          day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          rides: (recent.data ?? []).filter(
            (r) => new Date(r.created_at).toDateString() === d.toDateString()
          ).length,
        };
      });

      setStats({
        totalRides: rides.count ?? 0,
        activeDrivers: drivers.count ?? 0,
        totalUsers: users.count ?? 0,
        monthlyRevenue: (revenue.data ?? []).reduce((s, r) => s + Number(r.platform_fee ?? 0), 0),
        ridesByDay,
      });
    })();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Analytics</h1>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile icon={Route} label="Total Rides" value={stats?.totalRides.toLocaleString()} />
        <KpiTile icon={CarFront} label="Active Drivers" value={stats?.activeDrivers.toLocaleString()} />
        <KpiTile icon={Users} label="Total Users" value={stats?.totalUsers.toLocaleString()} />
        <KpiTile
          icon={CircleDollarSign}
          label="Monthly Revenue"
          value={stats ? formatCurrency(stats.monthlyRevenue) : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rides — last 14 days</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!stats ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.ridesByDay}>
                <defs>
                  <linearGradient id="emerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00c853" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#00c853" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "#00c853", strokeOpacity: 0.2 }} />
                <Area type="monotone" dataKey="rides" stroke="#00c853" strokeWidth={2.5} fill="url(#emerald)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value }: { icon: typeof Route; label: string; value?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-container/15 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="text-label-sm text-secondary">{label}</p>
          {value === undefined ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="truncate text-headline-md text-on-surface">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
