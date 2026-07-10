"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import type { SupportTicket } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["open", "in_progress", "resolved", "closed"] as const;

/** Support desk: triage tickets, reply, advance status. */
export default function AdminSupportPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("open");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [active, setActive] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setTickets(await repos().support.listAll(tab));
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setSending(true);
    try {
      const { support } = repos();
      await support.reply(active.id, reply.trim());
      if (active.status === "open") await support.setStatus(active.id, "in_progress");
      setReply("");
      setActive(null);
      void load();
    } finally {
      setSending(false);
    }
  }

  async function setStatus(ticket: SupportTicket, status: string) {
    await repos().support.setStatus(ticket.id, status);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Support</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t.replace("_", " ")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-on-surface-variant">
                    No {tab.replace("_", " ")} tickets.
                  </TableCell>
                </TableRow>
              )}
              {tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-label-md">{t.subject}</TableCell>
                  <TableCell>{t.user?.fullName ?? t.userId.slice(0, 8)}</TableCell>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "open" ? "warning" : t.status === "resolved" ? "success" : "secondary"}>
                      {t.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setActive(t)}>
                        Reply
                      </Button>
                      {t.status !== "resolved" && t.status !== "closed" && (
                        <Button size="sm" onClick={() => setStatus(t, "resolved")}>
                          Resolve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply — {active?.subject}</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendReply} className="flex gap-2">
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply…" autoFocus />
            <Button type="submit" size="icon" disabled={sending || !reply.trim()}>
              <Send />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
