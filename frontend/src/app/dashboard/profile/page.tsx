"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, KeyRound, User } from "lucide-react";

export default function ProfilePage() {
  const user = getStoredUser();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword) as { success: boolean; message?: string };
      if (res.success) {
        toast.success("Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(res.message ?? "Failed to change password.");
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Profile">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Profile Info Card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User size={16} className="text-primary" />
              Account Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{user?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{user?.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{user?.role?.replace("_", " ") ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>Enter your current password to set a new one.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Current Password</Label>
                <Input
                  type="password"
                  className="h-9"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <Input
                  type="password"
                  className="h-9"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input
                  type="password"
                  className="h-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Saving…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
