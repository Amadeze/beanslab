"use client";

import {
  InventoryDestinationField,
  inventoryDestinationLabel,
} from "@/components/inventory/InventoryDestinationField";
import type { RoastingLocationOption } from "../actions";

export function destinationLabel(option: RoastingLocationOption): string {
  return inventoryDestinationLabel(option);
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
  return (
    <InventoryDestinationField
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      outputLabel="hasil roasting"
    />
  );
}
