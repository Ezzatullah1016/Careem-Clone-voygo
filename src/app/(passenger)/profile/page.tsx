"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, LogOut, MapPin, Star, Ticket } from "lucide-react";
import type { AppNotification } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Profile: identity card, editable name, notifications, quick links, sign-out. */
export default function ProfilePage() {
  const { user, profile, signOut, refresh } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setName(profile?.fullName ?? "");
  }, [profile?.fullName]);

  useEffect(() => {
    if (!user) return;
    const { notifications: repo } = repos();
    void repo.listForUser(user.id).then((p) => setNotifications(p.items.slice(0, 5)));
    return repo.onNew(user.id, (n) => setNotifications((prev) => [n, ...prev].slice(0, 5)));
  }, [user]);

  async function saveName() {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      await repos().profiles.update(user.id, { fullName: name.trim() });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Profile" backHref="/home" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        {/* Identity */}
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatarUrl ?? undefined} alt={profile?.fullName ?? "You"} />
              <AvatarFallback>{(profile?.fullName ?? "V").charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-headline-md text-on-surface">{profile?.fullName ?? "Voygo rider"}</h2>
              <p className="text-label-sm text-on-surface-variant">{profile?.phone ?? profile?.email}</p>
              <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                <Star className="h-3.5 w-3.5 fill-[#FFB300] text-[#FFB300]" />
                {profile?.rating.toFixed(2)} · {profile?.ratingCount} ratings
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Edit name */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <Label htmlFor="name">Display name</Label>
            <div className="flex gap-2">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={saveName} disabled={saving || name === (profile?.fullName ?? "")}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardContent className="flex flex-col divide-y divide-black/5 p-2">
            <ProfileLink href="/locations" icon={MapPin} label="Saved locations" />
            <ProfileLink href="/support" icon={Ticket} label="Support" />
          </CardContent>
        </Card>

        {/* Recent notifications */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <h3 className="flex items-center gap-2 text-headline-md text-on-surface">
              <Bell className="h-5 w-5 text-primary" /> Notifications
            </h3>
            {notifications.length === 0 && (
              <p className="text-body-md text-on-surface-variant">You&apos;re all caught up.</p>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="rounded-2xl bg-white/40 p-3">
                <p className="text-label-md text-on-surface">{n.title}</p>
                <p className="text-label-sm text-on-surface-variant">{n.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button variant="destructive" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </main>
  );
}

function ProfileLink({ href, icon: Icon, label }: { href: string; icon: typeof MapPin; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl p-4 transition-colors hover:bg-black/5">
      <Icon className="h-5 w-5 text-primary" />
      <span className="flex-1 text-label-md text-on-surface">{label}</span>
      <ChevronRight className="h-5 w-5 text-secondary" />
    </Link>
  );
}
