"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Profile } from "@/core/entities";
import { repos } from "@/infrastructure/repositories";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** User management: search, role filter, activate/suspend. */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    const result = await repos().profiles.list({ role, search: search || undefined, page });
    setUsers(result.items);
    setTotal(result.total);
  }, [role, search, page]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250); // debounce search
    return () => clearTimeout(t);
  }, [load]);

  async function toggleActive(user: Profile) {
    await repos().profiles.setActive(user.id, !user.isActive);
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-lg text-on-surface">Users</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
          <Input
            placeholder="Search name, phone or email…"
            className="pl-11"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        {[undefined, "passenger", "driver", "admin"].map((r) => (
          <Button
            key={r ?? "all"}
            variant={role === r ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setRole(r);
              setPage(0);
            }}
          >
            {r ?? "All"}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{(u.fullName ?? "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="text-label-md">{u.fullName ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-on-surface-variant">{u.phone ?? u.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{u.role}</Badge>
                  </TableCell>
                  <TableCell>{u.rating.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "success" : "destructive"}>
                      {u.isActive ? "Active" : "Suspended"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant={u.isActive ? "destructive" : "default"} size="sm" onClick={() => toggleActive(u)}>
                      {u.isActive ? "Suspend" : "Reinstate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-label-sm text-on-surface-variant">{total} users</p>
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
