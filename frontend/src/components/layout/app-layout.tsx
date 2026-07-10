"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, setStoredUser } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { AuthUser } from "@/types/user";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  adminOnly?: boolean;
}

export function AppLayout({ children, title, adminOnly = false }: AppLayoutProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
    }

    authApi.me().then((res: any) => {
      if (res.success && res.data) {
        setStoredUser(res.data);
        setUser(res.data);
      } else {
        router.replace("/login");
      }
    }).catch(() => {
      router.replace("/login");
    }).finally(() => {
      setLoading(false);
    });
  }, [router]);

  const isAdmin = (role: string) => role === "admin" || role === "super_admin";

  useEffect(() => {
    if (!loading && user && adminOnly && !isAdmin(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, adminOnly, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-b-primary" />
      </div>
    );
  }

  if (!user) return null;
  if (adminOnly && !isAdmin(user.role)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
