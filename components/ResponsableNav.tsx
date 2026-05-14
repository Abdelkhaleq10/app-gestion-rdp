"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function ResponsableNav() {
  const pathname = usePathname();

  const links = [
    { href: "/responsable/dashboard", label: "Dashboard" },
    { href: "/responsable/demandes", label: "Demandes" },
    { href: "/responsable/historique", label: "Historique RDP" },
    { href: "/responsable/employes", label: "Employes" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3">
      <div className="flex flex-wrap gap-3">
        {links.map((link) => {
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-5 py-2.5 rounded-xl font-semibold transition ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}