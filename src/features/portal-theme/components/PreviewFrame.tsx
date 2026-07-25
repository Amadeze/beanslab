// =============================================================================
// PREVIEW FRAME — Iframe with postMessage protocol for live preview
// =============================================================================

"use client";

import { useRef, useEffect, useCallback } from "react";
import type { PortalThemeConfig } from "../types";
import { useCustomizerStore } from "../client/store";

const ALLOWED_MESSAGE_TYPES = ["THEME_PREVIEW_UPDATE"];

interface PreviewFrameProps {
  tenantId: string;
  subdomain: string;
}

export function PreviewFrame({ tenantId, subdomain }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const workingDraft = useCustomizerStore((s) => s.workingDraft);
  const previewViewport = useCustomizerStore((s) => s.previewViewport);
  const lastSentRef = useRef<string>("");

  const viewportWidths: Record<string, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  const sendConfigToIframe = useCallback(
    (config: PortalThemeConfig) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;

      const payload = JSON.stringify({
        source: "portal-customizer",
        version: 1,
        type: "THEME_PREVIEW_UPDATE",
        tenantId,
        payload: { config },
      });

      // Deduplicate
      if (payload === lastSentRef.current) return;
      lastSentRef.current = payload;

      iframe.contentWindow.postMessage(payload, window.location.origin);
    },
    [tenantId],
  );

  // Debounced postMessage
  useEffect(() => {
    const timer = setTimeout(() => {
      sendConfigToIframe(workingDraft);
    }, 300);
    return () => clearTimeout(timer);
  }, [workingDraft, sendConfigToIframe]);

  const iframeSrc = `/tenant/${subdomain}?preview=1`;

  return (
    <div className="flex flex-col h-full">
      <div
        className="mx-auto overflow-hidden rounded-lg border shadow-lg transition-all duration-300"
        style={{
          width: viewportWidths[previewViewport],
          maxWidth: "100%",
          borderColor: "var(--portal-border)",
        }}
      >
        {/* Browser chrome */}
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{ backgroundColor: "var(--portal-surface-alt)" }}
        >
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
          <div
            className="ml-4 flex-1 rounded-md px-3 py-1 text-xs"
            style={{ backgroundColor: "var(--portal-surface)", color: "var(--portal-text-muted)" }}
          >
            /tenant/{subdomain}
          </div>
        </div>

        {/* Iframe */}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full border-none"
          style={{
            height: previewViewport === "desktop" ? "calc(100vh - 200px)" : "600px",
          }}
          title="Portal Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
}
