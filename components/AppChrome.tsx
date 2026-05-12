"use client";

import Link from "next/link";
import type React from "react";
import {
  ArrowRight,
  Download,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HeaderProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

type StatCardProps = {
  label: string;
  value: React.ReactNode;
  detail?: string;
  tone?: "blue" | "green" | "red" | "amber" | "slate";
  icon: LucideIcon;
};

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 border-blue-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  red: "bg-red-50 text-red-700 border-red-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
};

export function BrandHeader({
  eyebrow = "Interface responsable",
  title = "Gestion d'acces RDP",
  subtitle = "Supervision du poste principal et suivi des acces.",
  actions,
}: HeaderProps) {
  return (
    <header className="border-b border-white/10 bg-[#0b1f3f] text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-5 py-4 lg:min-h-[124px] lg:grid-cols-[240px_1fr_auto] lg:items-center lg:px-6">
        <div className="flex justify-center lg:justify-start">
          <div className="flex h-24 w-56 max-w-full items-center justify-center lg:justify-start">
            <img
              src="/srm-sm-logo-white-text.png"
              alt="SRM-SM"
              className="h-24 w-auto max-w-full object-contain brightness-0 invert"
            />
          </div>
        </div>

        <div className="text-center lg:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">Application interne</p>
          <h1 className="mt-1 text-2xl font-black tracking-normal">{title}</h1>
          <p className="mt-1 text-sm text-blue-100">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-end">
          <div className="rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm">
            <p className="text-xs text-blue-200">{eyebrow}</p>
            <p className="font-bold">Responsable</p>
          </div>
          {actions}
          <Link
            href="/responsable/logout"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/15"
          >
            <LogOut className="size-4" />
            Logout
          </Link>
        </div>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <BrandHeader />
      <section className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-6">
        {children}
      </section>
    </main>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "blue",
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`flex size-11 items-center justify-center rounded-lg border ${toneClasses[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
      {detail && <p className="mt-4 text-sm text-slate-500">{detail}</p>}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-normal text-slate-950">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function ExportButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700"
    >
      <Download className="size-4" />
      Export CSV
    </Link>
  );
}

export function SearchButton({ children = "Rechercher" }: { children?: React.ReactNode }) {
  return (
    <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-800">
      <Search className="size-4" />
      {children}
    </button>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:text-blue-900">
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

export function SecureBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
      <ShieldCheck className="size-4" />
      Acces securise
    </div>
  );
}

export function DashboardIcon() {
  return <LayoutDashboard className="size-5" />;
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-5 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">SRM-SM</p>
            <p className="font-black text-slate-950">Gestion acces RDP</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-[#0b1f3f] px-6 py-6 text-white">
            <h1 className="text-2xl font-black tracking-normal">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-blue-100">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
