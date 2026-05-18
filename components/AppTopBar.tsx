"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  History,
  LayoutDashboard,
  LogOut,
  UserRoundCog,
} from "lucide-react";

const links = [
  {
    href: "/responsable/employes",
    label: "Gestion employes",
    icon: UserRoundCog,
    special: true,
  },
  {
    href: "/responsable/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/responsable/demandes",
    label: "Demandes",
    icon: ClipboardList,
  },
  {
    href: "/responsable/historique",
    label: "Historique RDP",
    icon: History,
  },
];

export default function AppTopBar() {
  const pathname = usePathname();

  return (
    <header className="relative z-40 w-full border-b border-blue-950/30 bg-[#173987] shadow-[0_18px_45px_rgba(15,23,42,0.20)]">
      <div className="mx-auto max-w-7xl px-5 py-5 lg:px-8">
        <div className="grid items-center gap-6 lg:grid-cols-[260px_1fr]">
          <Link
            href="/responsable/dashboard"
            className="flex items-center justify-center lg:justify-start"
          >
            <Image
              src="/images/logo-srm-icon.png"
              alt="Logo SRM-SM"
              width={330}
              height={165}
              className="h-[130px] w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              priority
            />
          </Link>

          <div className="flex flex-col items-center justify-center">
            <div className="w-full text-center">
              <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl lg:text-[42px]">
                Gestion d&apos;acces par RDP
              </h1>

              <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.42em] text-blue-100 md:text-sm">
                Poste principal - SRM-SM
              </p>
            </div>

            <nav className="mt-6 flex w-full items-center justify-center gap-3 overflow-x-auto pb-1">
              {links.map((link) => {
                const Icon = link.icon;
                const active =
                  pathname === link.href || pathname.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl px-5 text-sm font-black transition-all duration-200 ${
                      active
                        ? "bg-white text-blue-950 shadow-xl"
                        : link.special
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-950/20 hover:bg-emerald-600"
                        : "bg-white/12 text-white ring-1 ring-white/15 hover:bg-white/22"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}

              <Link
                href="/responsable/logout"
                className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-red-500 px-6 text-sm font-black text-white shadow-xl shadow-red-950/20 transition hover:bg-red-600"
              >
                <LogOut className="h-4 w-4" />
                Deconnexion
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}