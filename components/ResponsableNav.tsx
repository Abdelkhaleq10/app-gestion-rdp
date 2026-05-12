"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Clock3, LayoutDashboard } from "lucide-react";

export default function ResponsableNav() {
  const pathname = usePathname();

  const links = [
    { href: "/responsable/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/responsable/demandes", label: "Demandes", icon: ClipboardList },
    { href: "/responsable/historique", label: "Historique RDP", icon: Clock3 },
  ];

  return (
    <nav className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition ${
                isActive
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
