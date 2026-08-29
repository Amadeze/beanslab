import React from "react";
import {
  PageHeader,
  PageHeaderSkeleton,
  type PageHeaderMetric,
  type PageHeaderSignal,
} from "./PageHeader";
import type { OperatingStage } from "./operating-stages";

export type CompactHeaderMetric = PageHeaderMetric;
export type CompactHeaderSignal = PageHeaderSignal;

interface CompactHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  stage?: OperatingStage;
  signal?: CompactHeaderSignal;
  metrics?: CompactHeaderMetric[];
  next?: {
    label: string;
    href: string;
  };
  /** Compact mode untuk mobile: sembunyikan description, kurangi padding */
  compact?: boolean;
}

/**
 * Wrapper kompatibilitas di atas PageHeader — satu implementasi header.
 * Gunakan PageHeader langsung untuk modul baru; wrapper ini menahan
 * panggilan lama sampai sweep migrasi selesai.
 */
export function CompactHeader({
  title,
  description,
  actions,
  mobileActions,
  stage,
  signal,
  metrics,
  next,
  compact = false,
}: CompactHeaderProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      mobileActions={mobileActions}
      stage={stage}
      signal={signal}
      metrics={metrics}
      next={next}
      compact={compact}
    />
  );
}

export function CompactHeaderSkeleton({
  stage = false,
}: {
  stage?: boolean;
}) {
  return <PageHeaderSkeleton stage={stage} />;
}
