const FONT_STACKS: Record<string, string> = {
  "Playfair Display": 'var(--font-playfair-display), "Playfair Display", Georgia, serif',
  "JetBrains Mono": 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
  Orbitron: 'var(--font-orbitron), "Orbitron", sans-serif',
  "DM Sans": 'var(--font-dm-sans), "DM Sans", sans-serif',
  "Source Serif 4": 'var(--font-source-serif), "Source Serif 4", Georgia, serif',
  Nunito: 'var(--font-nunito), "Nunito", sans-serif',
  "Space Mono": 'var(--font-space-mono), "Space Mono", monospace',
  "Space Grotesk": 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
  Inter: 'var(--font-inter), "Inter", sans-serif',
  "EB Garamond": 'var(--font-eb-garamond), "EB Garamond", Georgia, serif',
  serif: 'var(--font-playfair-display), "Playfair Display", Georgia, serif',
  sans: 'var(--font-inter), "Inter", sans-serif',
  mono: 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
};

export function resolveThemeFontFamily(name: string) {
  return FONT_STACKS[name] || 'var(--font-dm-sans), "DM Sans", Arial, sans-serif';
}
