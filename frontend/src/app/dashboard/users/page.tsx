"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { usersApi } from "@/lib/api";
import { User } from "@/types/user";
import { getStoredUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Search, ChevronLeft, ChevronRight, Users, Loader2, UserPlus, Clock } from "lucide-react";

type RoleType = "super_admin" | "admin" | "viewer";
type StatusType = "active" | "inactive" | "pending";

export default function ManageUsersPage() {
  const currentUser = getStoredUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [updating, setUpdating] = useState<Record<number, boolean>>({});

  // Create user modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "viewer", status: "active" });
  const [creating, setCreating] = useState(false);

  const totalPages = Math.ceil(total / limit);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = { page, limit, search: search || undefined };
      if (statusFilter) params.status = statusFilter;
      const res: any = await usersApi.list(params);
      if (res.success) {
        setUsers(res.data);
        setTotal(res.meta.total);
      }
    } catch {
      toast.error("Gagal memuat data user.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleRoleChange = async (userId: number, role: RoleType) => {
    setUpdating((u) => ({ ...u, [userId]: true }));
    try {
      const res: any = await usersApi.updateRole(userId, role);
      if (res.success) { toast.success("Role berhasil diubah."); fetchUsers(); }
      else toast.error(res.message);
    } catch { toast.error("Gagal mengubah role."); }
    finally { setUpdating((u) => ({ ...u, [userId]: false })); }
  };

  const handleStatusChange = async (userId: number, status: StatusType) => {
    setUpdating((u) => ({ ...u, [userId]: true }));
    try {
      const res: any = await usersApi.updateStatus(userId, status);
      if (res.success) { toast.success("Status berhasil diubah."); fetchUsers(); }
      else toast.error(res.message);
    } catch { toast.error("Gagal mengubah status."); }
    finally { setUpdating((u) => ({ ...u, [userId]: false })); }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Semua field wajib diisi.");
      return;
    }
    setCreating(true);
    try {
      const res: any = await usersApi.create(createForm);
      if (res.success) {
        toast.success("User berhasil dibuat.");
        setCreateOpen(false);
        setCreateForm({ name: "", email: "", password: "", role: "viewer", status: "active" });
        fetchUsers();
      } else {
        toast.error(res.message ?? "Gagal membuat user.");
      }
    } catch { toast.error("Gagal membuat user."); }
    finally { setCreating(false); }
  };

  const pendingCount = users.filter((u) => (u as any).status === "pending").length;

  return (
    <AppLayout title="Manage Users" adminOnly>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Controls Card */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="text-blue-500" size={20} />
              Manajemen Pengguna
            </CardTitle>
            <CardDescription>
              Atur hak akses pengguna dan kelola status akun.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-2 flex-1 min-w-48">
                <Input
                  placeholder="Cari nama atau email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="h-9"
                />
                <Button size="sm" onClick={handleSearch} className="h-9">
                  <Search size={16} />
                </Button>
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">Semua Status</SelectItem>
                  <SelectItem value="active" className="text-xs">Active</SelectItem>
                  <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                  <SelectItem value="pending" className="text-xs flex items-center gap-1">
                    Pending Approval {pendingCount > 0 ? `(${pendingCount})` : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="h-9 gap-2">
                <UserPlus size={15} /> Buat User
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold">Nama</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold w-36">Role</TableHead>
                  <TableHead className="font-semibold w-44">Status</TableHead>
                  <TableHead className="font-semibold w-44">Dibuat Pada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j} className="py-4">
                          <div className="h-4 bg-muted animate-pulse rounded w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !users.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                      Tidak ada user ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const userStatus = (u as any).status as StatusType ?? "active";
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {u.name}
                            {userStatus === "pending" && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-300 text-orange-600">
                                <Clock size={9} className="mr-0.5" /> Pending
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={(v) => handleRoleChange(u.id, v as RoleType)}
                            disabled={updating[u.id]}
                          >
                            <SelectTrigger className="h-8 w-32 text-xs">
                              {updating[u.id] && <Loader2 className="animate-spin mr-1 shrink-0" size={12} />}
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {isSuperAdmin && <SelectItem value="super_admin" className="text-xs">Super Admin</SelectItem>}
                              <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                              <SelectItem value="viewer" className="text-xs">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={userStatus}
                            onValueChange={(v) => handleStatusChange(u.id, v as StatusType)}
                            disabled={updating[u.id]}
                          >
                            <SelectTrigger className="h-8 w-36 text-xs">
                              {updating[u.id] && <Loader2 className="animate-spin mr-1 shrink-0" size={12} />}
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active" className="text-xs">Active</SelectItem>
                              <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                              <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{formatDate(u.created_at)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/20 p-4 border rounded-md">
            <span>Total {total} user</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <span className="text-xs">Hal {page} / {totalPages}</span>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Create User Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus size={16} className="text-primary" />
              Buat User Baru
            </DialogTitle>
            <DialogDescription>Isi detail akun user yang akan dibuat.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama Lengkap</Label>
              <Input className="h-9" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" className="h-9" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" className="h-9" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Role</Label>
                <Select value={createForm.role} onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && <SelectItem value="super_admin" className="text-xs">Super Admin</SelectItem>}
                    <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                    <SelectItem value="viewer" className="text-xs">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status Awal</Label>
                <Select value={createForm.status} onValueChange={(v) => setCreateForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active" className="text-xs">Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Batal</Button>
              <Button type="submit" size="sm" disabled={creating} className="gap-2">
                {creating && <Loader2 size={14} className="animate-spin" />}
                {creating ? "Membuat…" : "Buat User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
