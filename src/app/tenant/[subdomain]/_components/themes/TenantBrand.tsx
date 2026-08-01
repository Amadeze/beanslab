"use client";

import { useEffect, useState } from "react";
import { ExtendedTenant } from "./ThemeProps";

interface TenantBrandProps {
  tenant: ExtendedTenant;
  fallback: string;
  logoClassName?: string;
}

export function TenantBrand({
  tenant,
  fallback,
  logoClassName = "h-8 w-8",
}: TenantBrandProps) {
  const brandName = tenant.name || fallback;
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoLoaded(false);
    setLogoFailed(false);
  }, [tenant.logoUrl]);

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={`${logoClassName} relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-surface)] text-xs font-bold uppercase text-[var(--t-accent)]`}
      >
        {brandName.trim().charAt(0) || "R"}
        {tenant.logoUrl && !logoFailed && (
          <img
            src={tenant.logoUrl}
            alt={`Logo ${brandName}`}
            className={`absolute inset-0 h-full w-full bg-[var(--t-bg)] object-contain transition-opacity duration-300 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLogoLoaded(true)}
            onError={() => setLogoFailed(true)}
          />
        )}
      </span>
      <span className="truncate">{brandName}</span>
    </span>
  );
}
