import { ArrowDownToLine, Boxes, Coffee, ReceiptText, WalletCards } from "lucide-react";

export interface MobileQuickAction {
  label: string;
  href: string;
  icon: typeof Coffee;
  hint: string;
}

export const QUICK_ACTIONS: MobileQuickAction[] = [
  { label: "Catat roast", href: "/roasting/batch", icon: Coffee, hint: "Mulai batch baru" },
  { label: "Catat lot", href: "/gudang/lot", icon: Boxes, hint: "Penerimaan green bean" },
  { label: "Kasir", href: "/kasir", icon: ReceiptText, hint: "Buat nota cepat" },
  { label: "Brief", href: "/dashboard/brief", icon: WalletCards, hint: "Ringkasan hari ini" },
  { label: "Download Studio", href: "/downloads/RoastdStudio-0.10.2-x64-setup.exe", icon: ArrowDownToLine, hint: "Pair mesin" },
];