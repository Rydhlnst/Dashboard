"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Table2,
  BarChart3,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PenLine,
  Columns3,
  History,
  Settings,
  Loader2,
  TrendingUp,
  MapPin,
  ClipboardCheck,
  DollarSign,
  AlertTriangle,
  UserCircle,
  DatabaseZap,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/types/user";
import { authApi, datasetsApi } from "@/lib/api";
import { clearStoredUser } from "@/lib/auth";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  SidebarDataset,
  getCachedSidebarDatasets,
  setCachedSidebarDatasets,
  subscribeSidebarCache,
} from "@/lib/sidebar-cache";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  tourId?: string;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

// Static groups — Dataset group is built dynamically below
const STATIC_BEFORE_DATASET: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, tourId: "nav-overview" },
    ],
  },
];

const STATIC_AFTER_DATASET: NavGroup[] = [
  {
    label: "Analitik",
    items: [
      { href: "/dashboard/analytics",  label: "Chart Builder",   icon: TrendingUp },
      { href: "/dashboard/charts",     label: "Dynamic Charts",  icon: PieChart,       adminOnly: true },
      { href: "/dashboard/location",   label: "Peta Lokasi",     icon: MapPin },
      { href: "/dashboard/acceptance", label: "Acceptance",      icon: ClipboardCheck },
      { href: "/dashboard/financial",  label: "Financial",       icon: DollarSign },
      { href: "/dashboard/issues",     label: "Issues",          icon: AlertTriangle },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/dashboard/data",         label: "Detail Data",      icon: Table2 },
      { href: "/dashboard/datasets",     label: "Dynamic Datasets", icon: DatabaseZap, adminOnly: true, tourId: "nav-datasets" },
      { href: "/dashboard/import",       label: "Import Data",      icon: Upload,      adminOnly: true, tourId: "nav-import" },
      { href: "/dashboard/manual-input", label: "Input Manual",     icon: PenLine,     adminOnly: true },
      { href: "/dashboard/manage-columns", label: "Manage Columns", icon: Columns3,    adminOnly: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/users",     label: "User Management", icon: Users,    adminOnly: true },
      { href: "/dashboard/audit-log", label: "Audit Log",       icon: History,  adminOnly: true },
      { href: "/dashboard/settings",  label: "Settings",        icon: Settings, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  user: AuthUser;
}

function isAdmin(role: string) {
  return role === "admin" || role === "super_admin";
}

const ACTIVE_NAV_STYLE: React.CSSProperties = {
  background: "hsl(var(--sidebar-primary))",
  color: "hsl(var(--sidebar-primary-foreground))",
};

const SIDEBAR_DATASET_LIMIT = 4;

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [showAllDatasets, setShowAllDatasets] = useState(false);

  // Dynamic sidebar datasets (module-level cache prevents API call on every navigation)
  const [dynamicDatasets, setDynamicDatasets] = useState<SidebarDataset[]>(
    () => getCachedSidebarDatasets() ?? []
  );

  useEffect(() => {
    let cancelled = false;

    const fetchSidebar = () => {
      const cached = getCachedSidebarDatasets();
      if (cached !== null) {
        if (!cancelled) setDynamicDatasets(cached);
        return;
      }
      datasetsApi.sidebarItems().then((res) => {
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const items = res.data as SidebarDataset[];
          setCachedSidebarDatasets(items);
          setDynamicDatasets(items);
        }
      }).catch(() => {});
    };

    fetchSidebar();
    const unsub = subscribeSidebarCache(fetchSidebar);
    return () => { cancelled = true; unsub(); };
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const visibleDatasets = useMemo(
    () => (showAllDatasets ? dynamicDatasets : dynamicDatasets.slice(0, SIDEBAR_DATASET_LIMIT)),
    [dynamicDatasets, showAllDatasets]
  );

  const navGroups = useMemo<NavGroup[]>(() => {
    const datasetDynamicItems: NavItem[] = visibleDatasets.map((ds) => ({
      href: `/dashboard/datasets/${ds.id}`,
      label: ds.page_label ?? ds.name,
      icon: Table2,
    }));

    return [
      ...STATIC_BEFORE_DATASET,
      {
        label: "Dataset",
        items: datasetDynamicItems,
      },
      ...STATIC_AFTER_DATASET,
    ];
  }, [visibleDatasets]);

  const handleNavigate = (href: string) => {
    if (href !== pathname) setPendingHref(href);
  };

  const prefetchRoute = (href: string) => {
    if (href !== pathname) router.prefetch(href);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      clearStoredUser();
      toast.success("Logged out successfully.");
      router.replace("/login");
    }
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {pendingHref && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-border" aria-hidden="true">
          <div className="h-full w-1/2 animate-pulse bg-primary" />
        </div>
      )}
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </div>
            {!collapsed && (
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                Dashboard
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3" aria-label="Dashboard navigation">
          {navGroups.map((group, gi) => {
            const visibleItems = group.items.filter(
              (item) => !item.adminOnly || isAdmin(user.role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div
                key={gi}
                className={gi > 0 ? "mt-3" : ""}
                data-tour={group.label === "Dataset" ? "nav-dataset-group" : undefined}
              >
                {group.label && !collapsed && (
                  <p className="px-4 pb-1 text-[10px] font-semibold uppercase text-sidebar-foreground/45">
                    {group.label}
                  </p>
                )}
                {group.label && collapsed && <div className="mx-3 mb-1 border-t border-sidebar-border" />}
                <div className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const pending = pendingHref === item.href;
                    const ItemIcon = pending ? Loader2 : Icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch
                        data-tour={item.tourId}
                        aria-current={active ? "page" : undefined}
                        aria-busy={pending || undefined}
                        onClick={() => handleNavigate(item.href)}
                        onMouseEnter={() => prefetchRoute(item.href)}
                        onFocus={() => prefetchRoute(item.href)}
                        className={cn(
                          "flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                          active
                            ? "shadow-sm"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          pending && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                        style={active ? ACTIVE_NAV_STYLE : undefined}
                        title={collapsed ? item.label : undefined}
                      >
                        <ItemIcon size={16} className={cn("shrink-0", pending && "animate-spin")} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
                {!collapsed && group.label === "Dataset" && dynamicDatasets.length > SIDEBAR_DATASET_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllDatasets((v) => !v)}
                    className="mt-0.5 flex w-full items-center gap-2 rounded-md px-4 py-1.5 text-xs text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground/80"
                  >
                    {showAllDatasets
                      ? "Sembunyikan"
                      : `Lihat ${dynamicDatasets.length - SIDEBAR_DATASET_LIMIT} dataset lainnya`}
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="mb-2 px-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/50">{user.email}</p>
              <span className="mt-1 inline-block rounded-md bg-sidebar-accent px-2 py-0.5 text-[10px] font-medium capitalize text-sidebar-foreground/70">
                {user.role.replace("_", " ")}
              </span>
            </div>
          )}
          <Link
            href="/dashboard/profile"
            onClick={() => handleNavigate("/dashboard/profile")}
            onMouseEnter={() => prefetchRoute("/dashboard/profile")}
            className={cn(
              "flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive("/dashboard/profile") && "shadow-sm"
            )}
            style={isActive("/dashboard/profile") ? ACTIVE_NAV_STYLE : undefined}
            title={collapsed ? "Profile" : undefined}
          >
            <UserCircle size={16} className="shrink-0" />
            {!collapsed && <span>Profile</span>}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground disabled:opacity-50"
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>{loggingOut ? "Logging out..." : "Logout"}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
