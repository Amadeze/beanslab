// =============================================================================
// CSS SANITIZER — Strips dangerous patterns from custom CSS
// =============================================================================

const DANGEROUS_PATTERNS = [
  /<script[\s>]/gi,
  /javascript\s*:/gi,
  /expression\s*\(/gi,
  /@import\s+url/gi,
  /behavior\s*:/gi,
  /-moz-binding\s*:/gi,
  /on\w+\s*=/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
];

export function sanitizeCSS(css: string): string {
  let clean = css;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, "/* stripped */");
  }
  return clean;
}

const DANGEROUS_HTML_PATTERNS = [
  /<script[\s>]/gi,
  /<iframe[\s>]/gi,
  /<object[\s>]/gi,
  /<embed[\s>]/gi,
  /<applet[\s>]/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /data\s*:\s*text\/html/gi,
];

export function sanitizeHTML(html: string): string {
  let clean = html;
  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    clean = clean.replace(pattern, "/* stripped */");
  }
  return clean;
}

export function isSafeUrl(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase().trim();
  return (
    lower.startsWith("/") ||
    lower.startsWith("https://") ||
    lower.startsWith("http://")
  ) && !lower.includes("javascript:") && !lower.includes("data:");
}
