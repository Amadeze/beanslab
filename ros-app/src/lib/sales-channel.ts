export const SALES_CHANNEL_LABELS: Record<string, string> = {
  WALK_IN: "Datang langsung",
  WHATSAPP: "WhatsApp",
  MARKETPLACE: "Marketplace",
  B2B_DIRECT: "B2B langsung",
  STOREFRONT: "Storefront",
  OTHER: "Lainnya",
};

export function getSalesChannelLabel(channel: string) {
  return SALES_CHANNEL_LABELS[channel] ?? channel.replaceAll("_", " ");
}
