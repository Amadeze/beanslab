import { getLots, getExpiryAlerts } from "../lot-actions";
import type { LotRow } from "../lot-actions";
import type { LotOperationalStatus } from "@/lib/lot";
import { Button } from "@/components/ui/button";
import { LOT_STATUS_META } from "@/lib/lot-status";
import { WorkflowState } from "@/components/ui/workflow-state";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { StandardPageLayout } from "@/components/StandardPageLayout";
import { EmptyState } from "@/components/ui/state";
import { Search, AlertTriangle, Package, ArrowRight, Printer, User } from "lucide-react";
import Link from "next/link";
import { deriveLotNextAction } from "@/lib/workflow";
import { NextAction } from "@/components/ui/next-action";

export const dynamic = "force-dynamic";

function LotsTable({ lots }: { lots: LotRow[] }) {
  if (lots.length === 0) {
    return (
      <Card className="p-8">
        <EmptyState
          icon={<Package size={18} />}
          title="Tidak ada lot"
          description="Belum ada lot yang tercatat. Lot terbentuk saat penerimaan barang masuk."
        />
      </Card>
    );
  }

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Kode Lot</TableHead>
            <TableHead>Produk</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Sisa (kg)</TableHead>
            <TableHead className="text-right">Sisa (unit)</TableHead>
            <TableHead className="text-right">Penempatan</TableHead>
            <TableHead>Review Mutu</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[116px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lots.map((lot) => (
            <TableRow key={lot.id}>
              <TableCell className="font-mono text-xs">{lot.batchCode}</TableCell>
              <TableCell>
                <div className="font-medium">{lot.productName ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{lot.productCode ?? ""}</div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{lot.supplierName ?? "-"}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono">{lot.quantityKg.toLocaleString("id-ID")}</TableCell>
               <TableCell className="text-right font-mono">{lot.quantityUnit.toLocaleString("id-ID")}</TableCell>
              <TableCell className="text-right">
                {lot.quantityKg > 0 ? (
                  <>
                    <span className="font-mono">{lot.placedKg.toLocaleString("id-ID")} kg</span>
                    <span className="text-xs text-muted-foreground"> / {lot.quantityKg.toLocaleString("id-ID")} kg</span>
                  </>
                ) : lot.quantityUnit > 0 ? (
                  <span className="font-mono">{lot.quantityUnit.toLocaleString("id-ID")} unit</span>
                ) : "-"}
              </TableCell>
               <TableCell className="text-xs">
                {lot.expiryDate ? new Date(lot.expiryDate).toLocaleDateString("id-ID") : "-"}
              </TableCell>
               <TableCell><WorkflowState {...LOT_STATUS_META[lot.status]} /></TableCell>
               <TableCell className="flex items-center justify-end gap-1">
                {(() => {
                  const next = deriveLotNextAction(lot);
                  return next ? (
                    <NextAction
                      label={next.label}
                      tone={next.tone}
                      href={next.href}
                      size="sm"
                      className="h-7 px-2 uppercase"
                    />
                  ) : null;
                })()}
                <Button variant="ghost" size="sm" render={<Link href={`/inventory/lots/${lot.id}/label`} />} title="Cetak label">
                  <Printer className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" render={<Link href={`/inventory/lots/${lot.id}`} />} title="Buka jejak">
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ExpiryAlertsSection({ alerts }: { alerts: { id: string; batchCode: string; productName: string | null; supplierName: string | null; expiryDate: string; quantityKg: number; daysUntilExpiry: number }[] }) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <Link
      href="/inventory/lots?status=expiring_soon"
      className="flex items-center justify-between gap-3 rounded-card border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 px-4 py-3 transition-colors hover:bg-[var(--status-warning)]/15"
    >
      <div className="flex items-center gap-2 text-[var(--status-warning)]">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-bold">
          {alerts.length} lot perlu review mutu
        </span>
      </div>
      <span className="text-xs font-semibold text-[var(--status-warning)]">
        Tampilkan →
      </span>
    </Link>
  );
}

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; product?: string; supplier?: string; status?: string }>;
}) {
  const params = await searchParams;
  const search = params.search ?? "";
  const product = params.product ?? "";
  const supplier = params.supplier ?? "";
  const status = params.status ?? "";

  const [lotsResult, alerts] = await Promise.all([
    getLots({
      search: search || undefined,
      productId: product || undefined,
      supplierId: supplier || undefined,
      status: (status as LotOperationalStatus) || undefined,
      perPage: 100,
    }),
    getExpiryAlerts(30),
  ]);

  return (
    <StandardPageLayout
        title="Lot & FEFO"
        description="Jejak asal bahan, saldo lot, dan prioritas pemakaian stok."
        stage="inventory"
        actionButton={
          <Link href="/inventory">
            <Button variant="outline" size="sm">
              <ArrowRight className="h-3 w-3 mr-1" />
              Kembali ke Inventori
            </Button>
          </Link>
        }
      >
      <div className="space-y-4">
      <ExpiryAlertsSection alerts={alerts} />

      <Card>
        <div className="text-sm font-bold mb-4">Daftar lot</div>
        <form className="mb-4 flex flex-wrap gap-3" action="/inventory/lots" method="get">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari kode lot..."
              name="search"
              defaultValue={search}
              className="pl-9"
            />
          </div>
          {product ? <input type="hidden" name="product" value={product} /> : null}
          {supplier ? <input type="hidden" name="supplier" value={supplier} /> : null}
            <select
             name="status"
             defaultValue={status}
             className="h-10 rounded-md border border-border bg-card px-3 text-sm"
           >
            <option value="">Semua status</option>
            <option value="consumed">Habis</option>
            <option value="expired">Perlu review</option>
            <option value="expiring_soon">Review segera</option>
            <option value="ok">OK</option>
          </select>
          <Button type="submit">Terapkan</Button>
        </form>

        <LotsTable lots={lotsResult.lots} />

        <div className="mt-3 text-xs text-muted-foreground text-right">
          Total: {lotsResult.total} lot
        </div>
      </Card>
      </div>
    </StandardPageLayout>
  );
}
