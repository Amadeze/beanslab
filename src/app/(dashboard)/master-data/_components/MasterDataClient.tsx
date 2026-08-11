"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Plus, Building2, Users, Package, CheckCircle2, XCircle, Pencil, UserCog, Loader2, PackageOpen, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsNav } from "@/app/(dashboard)/settings/_components/SettingsNav";
import { isTenantOwnerRole } from "@/lib/roles";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { StandardDrawer } from "@/components/StandardDrawer";
import { SupplierForm } from "./SupplierForm";
import { CustomerForm } from "./CustomerForm";
import { ProductForm } from "./ProductForm";
import { PackagingForm } from "./PackagingForm";
import { UserForm } from "./UserForm";
import { SupplyItemForm } from "./SupplyItemForm";
import { CoffeeOfferingForm } from "./CoffeeOfferingForm";
import type { MasterPageData, SupplierRow, CustomerRow, ProductRow, UserRow, PackagingRow, SupplyItemRow, OfferingRow } from "../actions";

interface MasterDataClientProps {
  data: MasterPageData;
  userRole: string;
  allowedTabs?: Tab[];
  initialTab?: Tab;
  title?: string;
  description?: string;
  workspace?: "supply" | "sales" | "settings";
}

type Tab = "supplier" | "pelanggan" | "produk" | "kemasan" | "supply" | "pengguna" | "penawaran";

const ALL_TABS: { id: Tab; label: string; icon: React.ElementType; count: (d: MasterPageData) => number }[] = [
  { id: "supplier",  label: "Supplier",  icon: Building2, count: (d) => d.suppliers.length },
  { id: "pelanggan", label: "Pelanggan", icon: Users,     count: (d) => d.customers.length },
  { id: "produk",    label: "Produk",    icon: Package,   count: (d) => d.products.length  },
  { id: "penawaran", label: "Penawaran", icon: Coffee,    count: (d) => d.offerings.length },
  { id: "kemasan",   label: "Kemasan",   icon: Package,   count: (d) => d.packagings.length },
  { id: "supply",    label: "Non-Kopi",  icon: PackageOpen, count: (d) => d.supplyItems.length },
  { id: "pengguna",  label: "Pengguna",  icon: UserCog,   count: (d) => d.users.length     },
];

function getTabsForRole(role: string) {
  if (isTenantOwnerRole(role)) return ALL_TABS;
  if (role === "MANAGER" || role === "OPERATOR") return ALL_TABS.filter(t => t.id !== "pengguna");
  if (role === "CASHIER") return ALL_TABS.filter(t => t.id === "pelanggan");
  return ALL_TABS.filter(t => t.id === "produk");
}

const PROD_TYPE_LABEL: Record<ProductRow["type"], string> = {
  GREEN_BEAN: "GB", ROASTED_BEAN: "RB", FINISHED_GOODS: "FG", PACKAGING: "PKG",
};
const PROD_TYPE_COLOR: Record<ProductRow["type"], string> = {
  GREEN_BEAN: "bg-lime-100 text-lime-700", ROASTED_BEAN: "bg-amber-100 text-amber-700",
  FINISHED_GOODS: "bg-violet-100 text-violet-700", PACKAGING: "bg-orange-100 text-orange-700",
};
const PROD_TYPE_FULL: Record<ProductRow["type"], string> = {
  GREEN_BEAN: "Green Bean", ROASTED_BEAN: "Roasted Bean", FINISHED_GOODS: "Produk Jadi", PACKAGING: "Kemasan",
};

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center glass-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/50 text-zinc-400 shadow-sm border border-white/60">
        <Package size={24} />
      </div>
      <div>
        <p className="text-sm font-bold text-zinc-600">Belum ada {label}</p>
        <p className="mt-1 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Klik "Tambah" untuk membuat</p>
      </div>
    </div>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 shadow-sm border border-emerald-100"><CheckCircle2 size={9} strokeWidth={3} />Aktif</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900/10 px-2 py-0.5 text-xs font-bold text-zinc-500 shadow-sm border border-zinc-200"><XCircle size={9} strokeWidth={3} />Nonaktif</span>;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="inline-flex items-center gap-1 rounded-lg border border-white/60 bg-white/50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 transition-all hover:border-white hover:bg-white hover:text-zinc-900 hover:shadow-md hover:scale-105">
      <Pencil size={10} strokeWidth={3} /> Edit
    </button>
  );
}

const ROLE_BADGE_CLASS: Record<UserRow["role"], string> = {
  OWNER: "bg-rose-100 text-rose-700", MANAGER: "bg-sky-100 text-sky-700",
  OPERATOR: "bg-amber-100 text-amber-700", CASHIER: "bg-violet-100 text-violet-700",
};

function RoleBadge({ role }: { role: UserRow["role"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASS[role]}`}>{role}</span>;
}

function EntityTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] glass-card p-0">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children, className, hide }: { children: React.ReactNode; className?: string; hide?: string }) {
  return <th className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-500 ${hide ?? ""} ${className ?? ""}`}>{children}</th>;
}

function SupplierTable({ rows, onEdit }: { rows: SupplierRow[]; onEdit: (r: SupplierRow) => void }) {
  if (rows.length === 0) return <EmptyState label="supplier" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Nama</Th>
          <Th hide="hidden md:table-cell">No. Telp</Th>
          <Th hide="hidden lg:table-cell">Wilayah</Th>
          <Th className="text-center">Beli</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3">
              <p className="font-medium text-zinc-800">{row.name}</p>
              {row.address && <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">{row.address}</p>}
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{row.phone ?? "\u2014"}</td>
            <td className="px-4 py-3 hidden lg:table-cell">
              {row.region
                ? <span className="rounded-full bg-zinc-900/10 px-2 py-0.5 text-xs font-medium text-zinc-700">{row.region}</span>
                : <span className="text-xs text-zinc-400">—</span>}
            </td>
            <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-zinc-700">{row.purchaseCount}×</td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

function CustomerTable({ rows, onEdit }: { rows: CustomerRow[]; onEdit: (r: CustomerRow) => void }) {
  if (rows.length === 0) return <EmptyState label="pelanggan" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Nama</Th>
          <Th hide="hidden md:table-cell">No. Telp</Th>
          <Th hide="hidden lg:table-cell">Email</Th>
          <Th className="text-center">Nota</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3">
              <p className="font-medium text-zinc-800">{row.name}</p>
              {row.address && <p className="text-[11px] text-zinc-500 truncate max-w-[180px]">{row.address}</p>}
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{row.phone ?? "\u2014"}</td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden lg:table-cell">{row.email ?? "\u2014"}</td>
            <td className="px-4 py-3 text-center font-mono text-xs font-semibold text-zinc-700">{row.invoiceCount}×</td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

function ProductTable({ rows, onEdit }: { rows: ProductRow[]; onEdit: (r: ProductRow) => void }) {
  if (rows.length === 0) return <EmptyState label="produk" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Nama</Th>
          <Th>Tipe</Th>
          <Th hide="hidden md:table-cell">Origin</Th>
          <Th hide="hidden lg:table-cell">Resep</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <p className="font-medium text-zinc-800">{row.name}</p>
                {row.coffeeSpecies && (
                  <span className="rounded-full bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                    {row.coffeeSpecies}
                  </span>
                )}
                {row.type === "ROASTED_BEAN" && row.roastLevel && (
                  <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                    {row.roastLevel.replace("_", " ")}
                  </span>
                )}
                {row.category && (
                  <span className="rounded-full bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">{row.category}</span>
                )}
              </div>
              {row.description && <p className="text-[11px] text-zinc-400 truncate max-w-[200px]">{row.description}</p>}
            </td>
            <td className="px-4 py-3">
              <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${PROD_TYPE_COLOR[row.type]}`}>{PROD_TYPE_LABEL[row.type]}</span>
              <span className="ml-1.5 text-xs text-zinc-500 hidden sm:inline">{PROD_TYPE_FULL[row.type]}</span>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{row.origin ?? "\u2014"}</td>
            <td className="px-4 py-3 hidden lg:table-cell">
              {row.type === "FINISHED_GOODS"
                ? row.recipe
                  ? <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 size={10} />{row.recipe.items.length} bahan</span>
                  : <span className="text-[11px] text-zinc-300">Belum ada resep</span>
                : <span className="text-xs text-zinc-300">—</span>}
            </td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

function PackagingTable({ rows, onEdit }: { rows: PackagingRow[]; onEdit: (r: PackagingRow) => void }) {
  if (rows.length === 0) return <EmptyState label="kemasan" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Kode</Th>
          <Th>Nama</Th>
          <Th className="text-right">Berat (g)</Th>
          <Th className="text-right">HPP (Rp)</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">{row.code}</td>
            <td className="px-4 py-3 font-medium text-zinc-800">{row.name}</td>
            <td className="px-4 py-3 text-right text-xs text-zinc-600">{row.weightGrams}</td>
            <td className="px-4 py-3 text-right text-xs text-zinc-600">{row.costPerUnit.toLocaleString("id-ID")}</td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

const SUPPLY_CATEGORY_LABEL: Record<SupplyItemRow["category"], string> = {
  PACKAGING: "Kemasan",
  INGREDIENT: "Bahan Baku",
  CONSUMABLE: "Consumable",
  MERCHANDISE: "Merchandise",
  SPARE_PART: "Spare Part",
  EQUIPMENT: "Alat",
  OTHER: "Lainnya",
};

const SUPPLY_CATEGORY_COLOR: Record<SupplyItemRow["category"], string> = {
  PACKAGING: "bg-orange-100 text-orange-700",
  INGREDIENT: "bg-lime-100 text-lime-700",
  CONSUMABLE: "bg-sky-100 text-sky-700",
  MERCHANDISE: "bg-violet-100 text-violet-700",
  SPARE_PART: "bg-slate-100 text-slate-700",
  EQUIPMENT: "bg-cyan-100 text-cyan-700",
  OTHER: "bg-zinc-100 text-zinc-700",
};

const SUPPLY_UNIT_LABEL: Record<SupplyItemRow["baseUnit"], string> = {
  KG: "kg", GRAM: "g", LITER: "L", METER: "m", ROLL: "roll", PCS: "pcs", BOX: "box", SET: "set", OTHER: "unit",
};

function SupplyTable({ rows, onEdit }: { rows: SupplyItemRow[]; onEdit: (r: SupplyItemRow) => void }) {
  if (rows.length === 0) return <EmptyState label="persediaan non-kopi" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Kode</Th>
          <Th>Nama</Th>
          <Th>Kategori</Th>
          <Th hide="hidden md:table-cell">Satuan</Th>
          <Th className="text-right">Stok</Th>
          <Th className="text-right">HPP (Rp)</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">{row.code}</td>
            <td className="px-4 py-3">
              <p className="font-medium text-zinc-800">{row.name}</p>
              {(row.consumableInProduction || row.includeInProductHpp) && (
                <p className="text-[11px] text-zinc-400">
                  {[row.consumableInProduction ? "produksi" : null, row.includeInProductHpp ? "HPP" : null].filter(Boolean).join(" · ")}
                </p>
              )}
            </td>
            <td className="px-4 py-3">
              <span className={`rounded px-1.5 py-0.5 text-xs font-bold uppercase ${SUPPLY_CATEGORY_COLOR[row.category]}`}>
                {SUPPLY_CATEGORY_LABEL[row.category]}
              </span>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{SUPPLY_UNIT_LABEL[row.baseUnit]}</td>
            <td className="px-4 py-3 text-right">
              <span className={`font-mono text-xs font-bold ${row.stockQuantity <= 0 ? "text-red-600" : "text-zinc-700"}`}>
                {row.stockQuantity.toLocaleString("id-ID")}
              </span>
              <span className="ml-1 text-[11px] text-zinc-400">{SUPPLY_UNIT_LABEL[row.baseUnit]}</span>
            </td>
            <td className="px-4 py-3 text-right text-xs text-zinc-600">{row.costPerUnit.toLocaleString("id-ID")}</td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

function UserTable({ rows, onEdit }: { rows: UserRow[]; onEdit: (r: UserRow) => void }) {
  if (rows.length === 0) return <EmptyState label="pengguna" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Nama</Th>
          <Th hide="hidden md:table-cell">Email</Th>
          <Th>Role</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3">
              <p className="font-medium text-zinc-800">{row.name}</p>
              <p className="text-[11px] text-zinc-400 md:hidden">{row.email}</p>
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{row.email}</td>
            <td className="px-4 py-3"><RoleBadge role={row.role} /></td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

const SOURCE_MODE_LABEL: Record<OfferingRow["sourceMode"], string> = {
  PURCHASED_ROASTED: "Beli jadi",
  INTERNAL_ROAST: "Sangrai sendiri",
};

function OfferingTable({ rows, onEdit }: { rows: OfferingRow[]; onEdit: (r: OfferingRow) => void }) {
  if (rows.length === 0) return <EmptyState label="penawaran kopi" />;
  return (
    <EntityTable>
      <thead className="border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md">
        <tr>
          <Th>Kode</Th>
          <Th>Nama</Th>
          <Th hide="hidden md:table-cell">Sumber</Th>
          <Th hide="hidden lg:table-cell">Varian</Th>
          <Th hide="hidden xl:table-cell">Giling</Th>
          <Th className="text-center">Status</Th>
          <Th className="text-center">Aksi</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--glass-border)]">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-[var(--glass-bg-hover)] transition-colors">
            <td className="px-4 py-3 font-mono text-xs font-semibold text-zinc-700">{row.code}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-zinc-800">{row.name}</p>
                {row.roastLevel && (
                  <span className="rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                    {row.roastLevel.replace("_", " ")}
                  </span>
                )}
                <span className="rounded-full bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                  {SOURCE_MODE_LABEL[row.sourceMode]}
                </span>
              </div>
              {row.description && <p className="text-[11px] text-zinc-400 truncate max-w-[220px]">{row.description}</p>}
            </td>
            <td className="px-4 py-3 text-xs text-zinc-500 hidden md:table-cell">{row.coffeeSource?.name ?? "\u2014"}</td>
            <td className="px-4 py-3 hidden lg:table-cell">
              <div className="flex flex-col gap-0.5">
                {row.variants.slice(0, 3).map((variant) => (
                  <span key={variant.id} className="text-[11px] text-zinc-600">
                    {variant.packageName} · {variant.netWeightGrams.toLocaleString("id-ID")}g · Rp {variant.unitPrice.toLocaleString("id-ID")}
                  </span>
                ))}
                {row.variants.length > 3 && <span className="text-[11px] text-zinc-400">+{row.variants.length - 3} lagi</span>}
              </div>
            </td>
            <td className="px-4 py-3 hidden xl:table-cell">
              <span className="text-[11px] text-zinc-500">{row.grindOptions.length} opsi{row.allowCustomGrind ? " · custom" : ""}</span>
            </td>
            <td className="px-4 py-3 text-center"><ActiveBadge active={row.isActive} /></td>
            <td className="px-4 py-3 text-center"><EditButton onClick={() => onEdit(row)} /></td>
          </tr>
        ))}
      </tbody>
    </EntityTable>
  );
}

export function MasterDataClient({
  data,
  userRole,
  allowedTabs,
  initialTab,
  title = "Data Master",
  description = "Tambah data dasar sekali, lalu gunakan langsung di transaksi",
  workspace,
}: MasterDataClientProps) {
  const router = useRouter();
  const TABS = useMemo(() => {
    const roleTabs = getTabsForRole(userRole);
    return allowedTabs?.length
      ? roleTabs.filter((tab) => allowedTabs.includes(tab.id))
      : roleTabs;
  }, [allowedTabs, userRole]);
  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab && TABS.some((tab) => tab.id === initialTab) ? initialTab : TABS[0].id,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);
  const [editProduct, setEditProduct] = useState<ProductRow | null>(null);
  const [editPackaging, setEditPackaging] = useState<PackagingRow | null>(null);
  const [editSupplyItem, setEditSupplyItem] = useState<SupplyItemRow | null>(null);
  const [editOffering, setEditOffering] = useState<OfferingRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const rawMaterials = useMemo(() => data.products.filter((p) => p.type === "ROASTED_BEAN" || p.type === "GREEN_BEAN"), [data.products]);

  const filteredData = useMemo(() => {
    return {
      suppliers: data.suppliers.filter(r => showInactive || r.isActive),
      customers: data.customers.filter(r => showInactive || r.isActive),
      products: data.products.filter(r => showInactive || r.isActive),
      packagings: data.packagings.filter(r => showInactive || r.isActive),
      supplyItems: data.supplyItems.filter(r => showInactive || r.isActive),
      offerings: data.offerings.filter(r => showInactive || r.isActive),
      users: data.users.filter(r => showInactive || r.isActive),
    };
  }, [data, showInactive]);

  const handleTabChange = (tab: Tab) => {
    setDrawerOpen(false); setMode("create");
    setEditSupplier(null); setEditCustomer(null); setEditProduct(null); setEditUser(null); setEditPackaging(null); setEditSupplyItem(null); setEditOffering(null);
    setActiveTab(tab);
  };

  const openCreate = () => {
    setMode("create");
    setEditSupplier(null); setEditCustomer(null); setEditProduct(null); setEditUser(null); setEditPackaging(null); setEditSupplyItem(null); setEditOffering(null);
    setDrawerOpen(true);
  };

  const openEditSupplier = (row: SupplierRow) => { setMode("edit"); setEditSupplier(row); setActiveTab("supplier"); setDrawerOpen(true); };
  const openEditCustomer = (row: CustomerRow) => { setMode("edit"); setEditCustomer(row); setActiveTab("pelanggan"); setDrawerOpen(true); };
  const openEditProduct = (row: ProductRow) => { setMode("edit"); setEditProduct(row); setActiveTab("produk"); setDrawerOpen(true); };
  const openEditPackaging = (row: PackagingRow) => { setMode("edit"); setEditPackaging(row); setActiveTab("kemasan"); setDrawerOpen(true); };
  const openEditSupplyItem = (row: SupplyItemRow) => { setMode("edit"); setEditSupplyItem(row); setActiveTab("supply"); setDrawerOpen(true); };
  const openEditOffering = (row: OfferingRow) => { setMode("edit"); setEditOffering(row); setActiveTab("penawaran"); setDrawerOpen(true); };
  const openEditUser = (row: UserRow) => { setMode("edit"); setEditUser(row); setActiveTab("pengguna"); setDrawerOpen(true); };

  const handleSuccess = () => {
    setDrawerOpen(false); setMode("create");
    setEditSupplier(null); setEditCustomer(null); setEditProduct(null); setEditUser(null); setEditPackaging(null); setEditSupplyItem(null); setEditOffering(null);
    router.refresh();
  };

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  const drawerTitle =
    mode === "edit"
      ? activeTab === "supplier"  ? `Edit Supplier${editSupplier  ? ` \u00b7 ${editSupplier.code}`  : ""}`
      : activeTab === "pelanggan" ? `Edit Pelanggan${editCustomer ? ` \u00b7 ${editCustomer.code}` : ""}`
      : activeTab === "produk"    ? `Edit Produk${editProduct     ? ` \u00b7 ${editProduct.code}`   : ""}`
      : activeTab === "kemasan"   ? `Edit Kemasan${editPackaging   ? ` \u00b7 ${editPackaging.code}`   : ""}`
      : activeTab === "supply"    ? `Edit Persediaan${editSupplyItem ? ` \u00b7 ${editSupplyItem.code}` : ""}`
      : activeTab === "penawaran" ? `Edit Penawaran${editOffering ? ` \u00b7 ${editOffering.code}` : ""}`
      :                             `Edit Pengguna${editUser      ? ` \u00b7 ${editUser.email}`      : ""}`
      : activeTab === "supplier"  ? "Tambah Supplier"
      : activeTab === "pelanggan" ? "Tambah Pelanggan"
      : activeTab === "produk"    ? "Tambah Produk"
      : activeTab === "kemasan"   ? "Tambah Kemasan"
      : activeTab === "supply"    ? "Tambah Persediaan Non-Kopi"
      : activeTab === "penawaran" ? "Tambah Penawaran Kopi"
      :                             "Tambah Pengguna";

  const submitFormId =
    activeTab === "supplier"  ? "supplier-form"  :
    activeTab === "pelanggan" ? "customer-form"  :
    activeTab === "produk"    ? "product-form"   :
    activeTab === "kemasan"   ? "packaging-form" :
    activeTab === "supply"    ? "supply-item-form" :
    activeTab === "penawaran" ? "offering-form" :
                                "user-form";

  const drawerSize = activeTab === "produk" || activeTab === "supply" || activeTab === "penawaran" ? "lg" : "md";

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title={title}
          description={description}
          eyebrow={workspace === "settings" ? "Pengaturan" : workspace === "sales" ? "Penjualan" : workspace === "supply" ? "Pasokan" : "Katalog"}
          stage={workspace === "supply" ? "inventory" : workspace === "sales" ? "sales" : undefined}
          actions={
            <Button size="sm" onClick={openCreate} variant="default" className="gap-1.5">
              <Plus size={14} />
              Tambah {activeTabMeta.label}
            </Button>
          }
          mobileActions={
            <Button size="sm" onClick={openCreate} variant="default" className="gap-1.5">
              <Plus size={14} />
              Tambah
            </Button>
          }
        />

        {workspace === "supply" ? <WorkspaceNav kind="supply" /> : null}
        {workspace === "sales" ? <WorkspaceNav kind="sales" /> : null}
        {workspace === "settings" ? <SettingsNav userRole={userRole} /> : null}

        <div className="custom-scrollbar flex-1 overflow-auto">
          <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">

            {/* Tab pills */}
            {TABS.length > 1 ? <div className="flex items-center gap-2 border-b border-[var(--glass-border)] mb-8 overflow-x-auto custom-scrollbar pb-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = tab.id === activeTab;
                const count = tab.count(data);
                return (
                  <button key={tab.id} type="button" onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "relative flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-all rounded-t-xl",
                      active ? "text-[var(--amber-deep)] dark:text-[var(--amber-warm)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]"
                    )}>
                    <Icon size={16} className={cn("transition-transform", active && "scale-110")} />
                    {tab.label}
                    <span className={cn(
                      "ml-1 rounded-full px-2 py-0.5 text-xs font-bold transition-colors",
                      active ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {count}
                    </span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-0 right-0 h-[3px] animate-in fade-in duration-200 rounded-t-full bg-gradient-to-r from-[var(--amber-warm)] to-[var(--amber-deep)] shadow-[0_-2px_10px_rgba(196,122,51,0.4)]"
                      />
                    )}
                  </button>
                );
              })}

              <div className="ml-auto pr-2 flex items-center">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-700 cursor-pointer transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-white/60 shadow-sm">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 border-zinc-300 w-3.5 h-3.5"
                  />
                  Tampilkan Non-aktif
                </label>
              </div>
            </div> : null}

            {/* Table content */}
            <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === "supplier"  && <SupplierTable rows={filteredData.suppliers} onEdit={openEditSupplier} />}
              {activeTab === "pelanggan" && <CustomerTable rows={filteredData.customers} onEdit={openEditCustomer} />}
              {activeTab === "produk"    && <ProductTable  rows={filteredData.products}  onEdit={openEditProduct}  />}
              {activeTab === "penawaran" && <OfferingTable rows={filteredData.offerings} onEdit={openEditOffering} />}
              {activeTab === "kemasan"   && <PackagingTable rows={filteredData.packagings} onEdit={openEditPackaging} />}
              {activeTab === "supply"    && <SupplyTable   rows={filteredData.supplyItems} onEdit={openEditSupplyItem} />}
              {activeTab === "pengguna"  && <UserTable     rows={filteredData.users}     onEdit={openEditUser}     />}
            </div>

          </div>
        </div>
      </div>

      <StandardDrawer open={drawerOpen}
        onOpenChange={(v) => { if (!isSubmitting) { setDrawerOpen(v); if (!v) { setMode("create"); setEditSupplier(null); setEditCustomer(null); setEditProduct(null); setEditPackaging(null); setEditSupplyItem(null); setEditOffering(null); setEditUser(null); } } }}
        title={drawerTitle} size={drawerSize}
        submitButton={
          <Button type="submit" form={submitFormId} size="sm" disabled={isSubmitting} className="gap-1.5 rounded-[8px] font-bold shadow-md disabled:opacity-60">
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            {isSubmitting ? "Menyimpan..." : (mode === "edit" ? "Simpan Perubahan" : "Simpan")}
          </Button>
        }>
        {activeTab === "supplier" && <SupplierForm id="supplier-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editSupplier ?? undefined : undefined} />}
        {activeTab === "pelanggan" && <CustomerForm id="customer-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editCustomer ?? undefined : undefined} />}
        {activeTab === "produk" && <ProductForm id="product-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editProduct ?? undefined : undefined} rawMaterials={rawMaterials} packagings={data.packagings} />}
        {activeTab === "penawaran" && <CoffeeOfferingForm id="offering-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editOffering ?? undefined : undefined} roastedMaterials={data.products.filter((product) => product.type === "ROASTED_BEAN")} supplyItems={data.supplyItems} />}
        {activeTab === "kemasan" && <PackagingForm id="packaging-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editPackaging ?? undefined : undefined} />}
        {activeTab === "supply" && <SupplyItemForm id="supply-item-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editSupplyItem ?? undefined : undefined} />}
        {activeTab === "pengguna" && <UserForm id="user-form" onSuccess={handleSuccess} onPendingChange={setIsSubmitting} initialData={mode === "edit" ? editUser ?? undefined : undefined} />}
      </StandardDrawer>
    </>
  );
}
