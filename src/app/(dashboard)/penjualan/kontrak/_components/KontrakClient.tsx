"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { toastSafe } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GlassPanel } from "@/components/ui/glass-panel";
import { SectionHeader } from "@/components/ui/section-header";
import { formatRupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  createContract,
  updateContract,
  addContractPrice,
  deleteContractPrice,
  getContracts,
  getContractPrices,
  type ContractRow,
  type ContractPriceRow,
  type KontrakPageData,
} from "../../contract-actions";

// =============================================================================
// HELPERS
// =============================================================================

type TierBadgeProps = { tier: string };

function TierBadge({ tier }: TierBadgeProps) {
  const tones: Record<string, string> = {
    BRONZE: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    SILVER: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    GOLD: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  };
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-bold", tones[tier] || "bg-gray-100 text-gray-700")}>
      {tier}
    </span>
  );
}

// =============================================================================
// CONTRACT FORM
// =============================================================================

type ContractFormState = {
  customerId: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  terms: string;
};

function emptyContractForm(partial?: Partial<ContractFormState>): ContractFormState {
  return {
    customerId: partial?.customerId || "",
    contractNumber: partial?.contractNumber || "",
    startDate: partial?.startDate || "",
    endDate: partial?.endDate || "",
    terms: partial?.terms || "",
  };
}

type ContractFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ContractRow | null;
  customers: { id: string; code: string; name: string }[];
  onSuccess: () => void;
};

function ContractForm({ open, onOpenChange, initial, customers, onSuccess }: ContractFormProps) {
  const [form, setForm] = useState<ContractFormState>(() => {
    if (!initial) return emptyContractForm();
    return {
      customerId: initial.customerId,
      contractNumber: initial.contractNumber,
      startDate: initial.startDate.slice(0, 10),
      endDate: initial.endDate ? initial.endDate.slice(0, 10) : "",
      terms: initial.terms || "",
    };
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        customerId: initial.customerId,
        contractNumber: initial.contractNumber,
        startDate: initial.startDate.slice(0, 10),
        endDate: initial.endDate ? initial.endDate.slice(0, 10) : "",
        terms: initial.terms || "",
      });
    } else {
      setForm(emptyContractForm());
    }
  }, [open, initial]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      customerId: form.customerId,
      contractNumber: form.contractNumber.trim(),
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      terms: form.terms.trim() || undefined,
    };
    const result = initial ? await updateContract(initial.id, payload) : await createContract(payload);
    setSubmitting(false);
    if (!result.success) {
      toastSafe.error(result.error);
      return;
    }
    toast.success(initial ? "Kontrak diperbarui." : "Kontrak dibuat.");
    onSuccess();
    onOpenChange(false);
  }

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Kontrak" : "Kontrak Baru"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui tanggal atau ketentuan kontrak." : "Buat kontrak OEM / Private Label baru."}
          </DialogDescription>
        </DialogHeader>
        <form id="contract-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pelanggan</Label>
            <Select
              value={form.customerId}
              onValueChange={(v) => setForm((f) => ({ ...f, customerId: v as string }))}
              disabled={isEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih pelanggan" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nomor Kontrak</Label>
            <Input
              value={form.contractNumber}
              onChange={(e) => setForm((f) => ({ ...f, contractNumber: e.target.value }))}
              placeholder="CTR-00001"
              required
              disabled={isEdit}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ketentuan</Label>
            <Textarea
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              placeholder="Syarat dan ketentuan kontrak..."
              rows={4}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="contract-form" disabled={submitting}>
            {submitting ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Buat Kontrak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// PRICE FORM
// =============================================================================

type PriceFormState = {
  productId: string;
  tierName: "BRONZE" | "SILVER" | "GOLD";
  minOrderQty: string;
  pricePerKg: string;
  pricePerUnit: string;
  notes: string;
};

function emptyPriceForm(): PriceFormState {
  return { productId: "", tierName: "BRONZE", minOrderQty: "0", pricePerKg: "", pricePerUnit: "", notes: "" };
}

type PriceFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: string;
  products: { id: string; code: string; name: string }[];
  onSuccess: () => void;
};

function PriceForm({ open, onOpenChange, contractId, products, onSuccess }: PriceFormProps) {
  const [form, setForm] = useState<PriceFormState>(emptyPriceForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(emptyPriceForm());
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addContractPrice(contractId, {
      productId: form.productId,
      tierName: form.tierName,
      minOrderQty: Number(form.minOrderQty),
      pricePerKg: form.pricePerKg ? Number(form.pricePerKg) : undefined,
      pricePerUnit: form.pricePerUnit ? Number(form.pricePerUnit) : undefined,
      notes: form.notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.success) {
      toastSafe.error(result.error);
      return;
    }
    toast.success("Harga tier ditambahkan.");
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Harga Tier</DialogTitle>
          <DialogDescription>Setel harga khusus untuk produk dalam kontrak ini.</DialogDescription>
        </DialogHeader>
        <form id="price-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Produk</Label>
            <Select value={form.productId} onValueChange={(v) => setForm((p) => ({ ...p, productId: v as string }))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih produk" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tier</Label>
            <Select
              value={form.tierName}
              onValueChange={(v) => setForm((p) => ({ ...p, tierName: v as "BRONZE" | "SILVER" | "GOLD" }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRONZE">BRONZE</SelectItem>
                <SelectItem value="SILVER">SILVER</SelectItem>
                <SelectItem value="GOLD">GOLD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Min Order Qty</Label>
            <Input
              type="number"
              step="0.01"
              value={form.minOrderQty}
              onChange={(e) => setForm((p) => ({ ...p, minOrderQty: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Harga per Kg</Label>
              <Input
                type="number"
                step="0.01"
                value={form.pricePerKg}
                onChange={(e) => setForm((p) => ({ ...p, pricePerKg: e.target.value }))}
                placeholder="Opsional"
              />
            </div>
            <div className="space-y-2">
              <Label>Harga per Unit</Label>
              <Input
                type="number"
                step="0.01"
                value={form.pricePerUnit}
                onChange={(e) => setForm((p) => ({ ...p, pricePerUnit: e.target.value }))}
                placeholder="Opsional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Catatan tambahan..."
              rows={3}
            />
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button type="submit" form="price-form" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Tambah Harga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// DETAIL DIALOG
// =============================================================================

type DetailDialogProps = {
  contract: ContractRow;
  prices: ContractPriceRow[];
  products: { id: string; code: string; name: string }[];
  onClose: () => void;
  onRefresh: () => void;
};

function ContractDetailDialog({ contract, prices, products, onClose, onRefresh }: DetailDialogProps) {
  const [addingPrice, setAddingPrice] = useState(false);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-bold">{contract.contractNumber}</DialogTitle>
              <DialogDescription>
                {contract.customerName} &middot; {contract.customerTier}
              </DialogDescription>
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-xs font-bold",
                contract.isActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              {contract.isActive ? "AKTIF" : "NONAKTIF"}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-stone-500">Mulai</p>
              <p className="font-mono font-semibold">
                {new Date(contract.startDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Selesai</p>
              <p className="font-mono font-semibold">
                {contract.endDate
                  ? new Date(contract.endDate).toLocaleDateString("id-ID", { dateStyle: "medium" })
                  : "Tidak terbatas"}
              </p>
            </div>
          </div>

          {contract.terms && (
            <GlassPanel padding="sm">
              <p className="text-xs font-semibold text-stone-600">Ketentuan</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-stone-700">{contract.terms}</p>
            </GlassPanel>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-900">Daftar Harga Tier ({prices.length})</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setAddingPrice(true)}
            >
              <Plus size={14} /> Tambah
            </Button>
          </div>

          {prices.length === 0 ? (
            <p className="text-xs text-stone-500">Belum ada harga tier untuk kontrak ini.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow>
                    <TableHead>Produk</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Qty Min</TableHead>
                    <TableHead className="text-right">Harga/Kg</TableHead>
                    <TableHead className="text-right">Harga/Unit</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prices.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="text-sm font-semibold text-stone-900">{p.productName}</p>
                        <p className="font-mono text-[11px] text-stone-500">{p.productCode}</p>
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={p.tierName} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {p.minOrderQty.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {p.pricePerKg !== null ? formatRupiah(p.pricePerKg) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {p.pricePerUnit !== null ? formatRupiah(p.pricePerUnit) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-stone-400 hover:text-red-600"
                          onClick={async () => {
                            const res = await deleteContractPrice(p.id);
                            if (res.success) {
                              toast.success("Harga dihapus.");
                              onRefresh();
                            } else {
                              toastSafe.error(res.error);
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>

      <PriceForm
        open={addingPrice}
        onOpenChange={setAddingPrice}
        contractId={contract.id}
        products={products}
        onSuccess={onRefresh}
      />
    </Dialog>
  );
}

// =============================================================================
// CLIENT
// =============================================================================

type KontrakClientProps = {
  initialData: KontrakPageData;
};

export function KontrakClient({ initialData }: KontrakClientProps) {
  const [data, setData] = useState<KontrakPageData>(initialData);
  const [contractOpen, setContractOpen] = useState(false);
  const [detailContract, setDetailContract] = useState<ContractRow | null>(null);
  const [detailPrices, setDetailPrices] = useState<ContractPriceRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function refresh() {
    setIsLoading(true);
    const fresh = await getContracts();
    setData(fresh);
    setIsLoading(false);
  }

  async function openDetail(contract: ContractRow) {
    setDetailContract(contract);
    setDetailPrices([]);
    const prices = await getContractPrices(contract.id);
    setDetailPrices(prices);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="custom-scrollbar flex-1 overflow-auto">
        <div className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pb-8 relative z-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <SectionHeader
              title="OEM / Private Label"
              description="Kelola kontrak dan harga khusus pelanggan OEM."
            />
            <div className="flex items-center gap-2">
              <Button
                size="default"
                variant="outline"
                className="gap-2 rounded-lg px-4 font-semibold"
                onClick={refresh}
                disabled={isLoading}
              >
                {isLoading ? "Memuat..." : "Refresh"}
              </Button>
              <Button
                size="default"
                variant="default"
                className="gap-2 px-5"
                onClick={() => { setDetailContract(null); setContractOpen(true); }}
              >
                <Plus size={16} />
                Kontrak Baru
              </Button>
            </div>
          </div>

          <GlassPanel padding="md" className="mt-4">
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <Table>
                <TableHeader className="bg-stone-50">
                  <TableRow>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Pelanggan</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Mulai</TableHead>
                    <TableHead>Selesai</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-28 text-center text-sm text-stone-500">
                        Belum ada kontrak.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.contracts.map((c: ContractRow) => (
                    <TableRow key={c.id} className={!c.isActive ? "opacity-60" : ""}>
                      <TableCell>
                        <p className="text-sm font-semibold text-stone-900">{c.contractNumber}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-stone-900">{c.customerName}</p>
                        <p className="font-mono text-[11px] text-stone-500">{c.customerId}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-stone-600">{c.customerTier.toLowerCase().replace(/_/g, " ")}</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(c.startDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.endDate
                          ? new Date(c.endDate).toLocaleDateString("id-ID", { dateStyle: "medium" })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-stone-600">{c.customerTier}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-medium text-stone-600">{c.priceCount} SKU</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 text-xs font-bold",
                            c.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-gray-100 text-gray-500",
                          )}
                        >
                          {c.isActive ? "AKTIF" : "NONAKTIF"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Detail"
                            onClick={() => openDetail(c)}
                            className="text-stone-400 hover:text-[var(--amber-deep)]"
                          >
                            <ChevronDown size={15} />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Edit"
                            onClick={() => {
                              setDetailContract(null);
                              setContractOpen(true);
                            }}
                            className="text-stone-400 hover:text-[var(--amber-deep)]"
                          >
                            <Pencil size={15} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassPanel>
        </div>
      </div>

      <ContractForm
        open={contractOpen}
        onOpenChange={setContractOpen}
        initial={detailContract}
        customers={data.customers}
        onSuccess={refresh}
      />

      {detailContract && (
        <ContractDetailDialog
          contract={detailContract}
          prices={detailPrices}
          products={data.products}
          onClose={() => setDetailContract(null)}
          onRefresh={async () => {
            await refresh();
            if (detailContract) openDetail(detailContract);
          }}
        />
      )}
    </div>
  );
}
