export const ROAST_LEVEL_LABELS = {
  LIGHT: "Light",
  MEDIUM: "Medium",
  MEDIUM_DARK: "Medium Dark",
  DARK: "Dark",
} as const;

export type RoastLevelValue = keyof typeof ROAST_LEVEL_LABELS;

export function getRoastLevelLabel(level: string): string {
  return ROAST_LEVEL_LABELS[level as RoastLevelValue] ?? level;
}

/**
 * Removes inventory-state words without guessing the coffee species or origin.
 * "Robusta Malang GB" therefore remains "Robusta Malang".
 */
export function greenBeanIdentity(name: string) {
  const cleaned = name
    .replace(/\bgreen\s*beans?\b/gi, " ")
    .replace(/\bgb\b/gi, " ")
    .replace(/\bmentah\b/gi, " ")
    .replace(/[|·—–_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || name.trim();
}
export function roastedBeanName(greenBeanName: string, roastLevel: RoastLevelValue) {
  return `${greenBeanIdentity(greenBeanName)} · ${ROAST_LEVEL_LABELS[roastLevel]}`;
}
