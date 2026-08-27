import * as cssTree from "css-tree";

export const MAX_CSS_LENGTH = 1000;
export const MAX_DECLARATIONS = 50;
export const MAX_VALUE_LENGTH = 256;
export const MAX_FUNCTION_COUNT = 10;
export const MAX_FUNCTION_DEPTH = 3;

export type SanitizeResult = { ok: true; css: string } | { ok: false; error: string };

export function sanitizeCSS(css: string): SanitizeResult {
  if (!css.trim()) return { ok: true, css: "" };
  if (css.length > MAX_CSS_LENGTH) return { ok: false, error: "CSS too long" };

  try {
    const ast = cssTree.parse(css, { context: "declarationList" });
    const validationError = validateDeclarationList(ast);
    if (!validationError.ok) return { ok: false, error: validationError.error || "Invalid CSS" };

    const clean = cssTree.generate(ast);
    if (clean.includes("<") || clean.includes(">")) {
      return { ok: false, error: "CSS contains unsafe characters" };
    }
    return { ok: true, css: clean };
  } catch (e) {
    return { ok: false, error: "Invalid CSS" };
  }
}

export function validateDeclarationList(ast: cssTree.CssNode): { ok: boolean; error?: string } {
  if (ast.type !== "DeclarationList") {
    return { ok: false, error: "Not a declaration list" };
  }

  let declCount = 0;
  let hasError = false;
  let errorMsg = "";

  try {
    cssTree.walk(ast, {
      enter: (node) => {
        if (hasError) return;
        if (node.type === "Declaration") {
          declCount++;
          if (declCount > MAX_DECLARATIONS) {
            hasError = true;
            errorMsg = "Too many declarations";
            return;
          }
          if (node.important) {
            hasError = true;
            errorMsg = "!important is not allowed";
            return;
          }
          if (typeof node.property !== "string" || !node.value || (typeof node.value !== "string" && node.value.type === "Raw")) {
            hasError = true;
            errorMsg = "Invalid declaration structure";
            return;
          }
          const prop = node.property.toLowerCase();
          if (prop.startsWith("-") || prop.startsWith("*") || prop.startsWith("_") || prop === "behavior" || prop === "z-index" || prop === "inset" || prop === "top" || prop === "pointer-events" || prop === "content" || prop === "cursor" || prop === "all" || prop === "position") {
            hasError = true;
            errorMsg = `Property ${prop} is not allowed`;
            return;
          }
          
          const match = cssTree.lexer.matchDeclaration(node as cssTree.Declaration);
          if (match.error) {
            hasError = true;
            errorMsg = match.error.message || "Invalid CSS declaration";
            return;
          }
        } else if (node.type === "Url") {
          hasError = true;
          errorMsg = "URLs are not allowed";
          return;
        } else if (node.type === "Atrule" || node.type === "SelectorList" || node.type === "Rule" || node.type === "StyleSheet" || node.type === "Raw") {
          hasError = true;
          errorMsg = `Node type ${node.type} is not allowed`;
          return;
        } else if (node.type === "Function") {
          const name = node.name?.toLowerCase();
          if (name === "url" || name === "expression" || name === "env" || name === "attr" || name === "var") {
            hasError = true;
            errorMsg = `Function ${name}() is not allowed`;
            return;
          }
        } else if (node.type === "Dimension") {
          const unit = node.unit?.toLowerCase();
          if (unit === "vw" || unit === "vh" || unit === "vmin" || unit === "vmax" || unit === "dvh" || unit === "cqw") {
            hasError = true;
            errorMsg = `Viewport unit ${unit} is not allowed`;
            return;
          }
        }
      }
    });
  } catch (err) {
    return { ok: false, error: "Invalid AST structure" };
  }

  if (hasError) return { ok: false, error: errorMsg };

  // check string length limits
  let valueLengthValid = true;
  let funcCountValid = true;
  let funcDepthValid = true;

  try {
    cssTree.walk(ast, {
      enter: (node) => {
        if (node.type === "Declaration") {
          const valueAst = node.value as cssTree.CssNode;
          const valueStr = cssTree.generate(valueAst);
          if (valueStr.length > MAX_VALUE_LENGTH) {
            valueLengthValid = false;
          }
          
          let localFuncCount = 0;
          let localMaxDepth = 0;
          let currentDepth = 0;

          cssTree.walk(valueAst, {
            enter: (n) => {
              if (n.type === "Function") {
                localFuncCount++;
                currentDepth++;
                if (currentDepth > localMaxDepth) localMaxDepth = currentDepth;
              }
            },
            leave: (n) => {
              if (n.type === "Function") {
                currentDepth--;
              }
            }
          });

          if (localFuncCount > MAX_FUNCTION_COUNT) funcCountValid = false;
          if (localMaxDepth > MAX_FUNCTION_DEPTH) funcDepthValid = false;
        }
      }
    });
  } catch (err) {
    return { ok: false, error: "Invalid AST structure" };
  }

  if (!valueLengthValid) return { ok: false, error: "Value too long" };
  if (!funcCountValid) return { ok: false, error: "Too many functions" };
  if (!funcDepthValid) return { ok: false, error: "Function depth too high" };

  return { ok: true };
}

export function customCSSToStyleMap(css: string): Record<string, string> {
  const result = sanitizeCSS(css);
  if (!result.ok || !result.css) return {};
  
  const map: Record<string, string> = {};
  const ast = cssTree.parse(result.css, { context: "declarationList" }) as any;
  
  if (ast.children) {
    ast.children.forEach((node: any) => {
      if (node.type === "Declaration") {
        const prop = node.property.replace(/-([a-z])/g, (g: string) => g[1].toUpperCase());
        map[prop] = cssTree.generate(node.value);
      }
    });
  }
  
  return map;
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
