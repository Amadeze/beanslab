"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintLabelButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer size={15} /> Cetak label
    </Button>
  );
}
