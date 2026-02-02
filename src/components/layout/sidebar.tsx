"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Radar,
  LayoutDashboard,
  Building2,
  Search,
  FileText,
  Swords,
  Settings,
  Bell,
} from "lucide-react";

const mainNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Brand Kit", icon: Building2, href: "/brand" },
  { label: "Probes", icon: Search, href: "/probes" },
  { label: "Content", icon: FileText, href: "/content" },
];

const secondaryNavItems = [
  { label: "Competitive", icon: Swords, href: "/competitive" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch("/api/alerts?unread=true");
        if (res.ok) {
          const data = await res.json();
          const alerts = Array.isArray(data) ? data : data.alerts ?? [];
          setAlertCount(alerts.length);
        }
      } catch {
        // Silently ignore alert fetch failures
      }
    }
    fetchAlerts();
  }, []);

  const renderNavItem = (item: (typeof mainNavItems)[number]) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-gray-800 text-white"
            : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
        }`}
      >
        <item.icon className="h-5 w-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-gray-100">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-6 py-5">
        <Radar className="h-6 w-6 text-blue-400" />
        <span className="text-lg font-bold tracking-tight">Citability</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {mainNavItems.map(renderNavItem)}

        {/* Divider */}
        <div className="my-3 border-t border-gray-800" />

        {secondaryNavItems.map(renderNavItem)}

        {/* Alerts indicator */}
        {alertCount > 0 && (
          <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400">
            <Bell className="h-5 w-5" />
            <span>Alerts</span>
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
              {alertCount}
            </span>
          </div>
        )}
      </nav>

      {/* Cost footer */}
      <div className="border-t border-gray-800 px-6 py-4">
        <p className="text-xs text-gray-500">Today&apos;s usage</p>
        <p className="text-sm font-semibold text-gray-300">Cost: $0.00 today</p>
      </div>
    </aside>
  );
}
