"use client";

import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import type { SupportTicket } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { useAuth } from "@/hooks/use-auth";
import { TopBar } from "@/components/glass/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Passenger support: open a ticket, see ticket statuses. */
export default function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    void repos().support.listMine(user.id).then(setTickets);
  }, [user]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const ticket = await repos().support.createTicket({ subject: subject.trim(), body: body.trim() });
      setTickets((prev) => [ticket, ...prev]);
      setSubject("");
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-primary-container/5 pb-[110px] pt-[90px]">
      <TopBar title="Support" backHref="/profile" />

      <div className="mx-auto flex max-w-[600px] flex-col gap-6 px-container-padding">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <h2 className="flex items-center gap-2 text-headline-md text-on-surface">
                <LifeBuoy className="h-5 w-5 text-primary" /> How can we help?
              </h2>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="body">Describe the issue</Label>
                <textarea
                  id="body"
                  rows={4}
                  className="w-full rounded-2xl border-none bg-surface-container-lowest px-4 py-3 text-body-md focus:outline-none focus:ring-2 focus:ring-primary-container"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={sending}>
                Submit ticket
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col divide-y divide-black/5 p-2">
            {tickets.length === 0 && (
              <p className="p-6 text-center text-body-md text-on-surface-variant">No tickets yet.</p>
            )}
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-md text-on-surface">{t.subject}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={t.status === "resolved" || t.status === "closed" ? "success" : "warning"}>
                  {t.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
