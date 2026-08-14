"use client";

import { MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RoastingLocationOption } from "../actions";

export function destinationLabel(option: RoastingLocationOption): string {
  return `${option.warehouseName} · ${option.name}`;
}

export function RoastingDestinationField({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: RoastingLocationOption[];
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return (
      <div>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Lokasi Hasil
        </Label>
        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Lokasi penyimpanan default akan dipilih otomatis saat roasting selesai.
        </p>
      </div>
    );
  }

  const single = options.length === 1;
  const selected = options.find((option) => option.id === value) ?? options[0]!;
  const selectedLabel = destinationLabel(selected);

  if (single) {
    return (
      <div>
        <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
          Lokasi Hasil
        </Label>
        <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <MapPin size={14} className="shrink-0 text-slate-400" />
          {selectedLabel}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Hasil roasting akan ditempatkan di lokasi ini.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-xs uppercase font-bold tracking-wider text-slate-500">
        Lokasi Hasil
      </Label>
      <Select
        value={value || selected.id}
        onValueChange={(next) => onChange(next ?? "")}
        disabled={disabled}
      >
        <SelectTrigger className="mt-1 h-9 w-full">
          <SelectValue placeholder="Pilih lokasi...">{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {destinationLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1 text-xs text-slate-500">
        Hasil roasting akan ditempatkan di lokasi ini.
      </p>
    </div>
  );
}