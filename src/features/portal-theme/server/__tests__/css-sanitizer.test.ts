// =============================================================================
// CSS SANITIZER TESTS — fail-closed validation of custom CSS declaration lists
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  sanitizeCSS,
  customCSSToStyleMap,
  validateDeclarationList,
  MAX_CSS_LENGTH,
  MAX_DECLARATIONS,
  MAX_VALUE_LENGTH,
  MAX_FUNCTION_COUNT,
  MAX_FUNCTION_DEPTH,
} from "../css-sanitizer";
import type { CssNode } from "css-tree";

describe("sanitizeCSS — valid declaration lists", () => {
  const validCases = [
    "color: red",
    "color: red; padding: 8px",
    "color:#FF5733",
    "display: flex",
    "display: inline-grid",
    'font-family: "Inter", sans-serif',
    "font-family: Plus Jakarta Sans",
    "line-height: 1.6",
    "letter-spacing: -0.02em",
    "text-shadow: 0 1px 2px rgba(0,0,0,.2)",
    "box-shadow: 0 0 10px #000",
    "border-radius: 12px",
    "border: 1px solid #eee",
    "transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
    "transform: rotate(45deg) translateX(10px)",
    "filter: blur(4px)",
    "background-image: linear-gradient(red, blue)",
    "width: calc(100% - 40px)",
    "grid-template-columns: repeat(2, 1fr)",
    "margin: -12px 0",
    "opacity: 0.5",
  ];

  for (const css of validCases) {
    it(`accepts: ${css}`, () => {
      const result = sanitizeCSS(css);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.css).toMatch(/^[a-z-]+:/);
        expect(result.css).not.toMatch(/[<>]/);
      }
    });
  }

  it("reserializes from the AST (normalized output)", () => {
    const result = sanitizeCSS("color: red;   padding:   8px  ;");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.css).toBe("color:red;padding:8px");
  });

  it("rejects !important explicitly (cannot be expressed in React inline styles)", () => {
    const result = sanitizeCSS("color: red !important");
    expect(result.ok).toBe(false);
  });

  it("accepts empty and whitespace-only input", () => {
    expect(sanitizeCSS("")).toEqual({ ok: true, css: "" });
    expect(sanitizeCSS("   ")).toEqual({ ok: true, css: "" });
  });
});

describe("sanitizeCSS — rejects dangerous / takeover payloads (fail closed)", () => {
  const rejectedCases: Array<[string, string]> = [
    ["</style><script>alert(1)</script>", "tag breakout"],
    ["color: red</style><script>alert(1)</script>", "tag breakout inside declarations"],
    ["color: <script>alert(1)</script>", "script inside value"],
    ["font-family: '</style><script>alert(1)</script>'", "script in string value"],
    ["@import url(https://evil.example/x.css)", "at-rule"],
    ["@import 'x.css'", "at-rule string"],
    ["background: url(javascript:alert(1))", "javascript url"],
    ["background: url(https://evil.example/a.png)", "url()"],
    ["cursor: url(evil.cur), pointer", "url in cursor"],
    ["width: expression(alert(1))", "expression()"],
    ["width: -moz-binding(url(evil.xml))", "moz binding"],
    ["behavior: url(evil.htc)", "behavior"],
    [".a { color: red }", "selector / rule"],
    ["#hero { color: red }", "id selector / rule"],
    ["a:hover { color: red }", "rule"],
    ["color: red; .a { color: blue }", "mixed rule"],
    ["position: fixed", "position"],
    ["position: absolute", "position"],
    ["z-index: 2147483647", "z-index"],
    ["inset: 0", "inset"],
    ["top: 0", "top"],
    ["pointer-events: none", "pointer-events"],
    ['content: "</style><script>alert(1)</script>"', "content"],
    ["cursor: pointer", "cursor"],
    ["all: unset", "all"],
    ["--evil: red", "custom property"],
    ["--x: url(javascript:1)", "custom property url"],
    ["width: 100vw", "viewport unit"],
    ["height: 100dvh", "viewport unit"],
    ["width: calc(100vw - 1px)", "viewport unit inside calc"],
    ["max-width: 100cqw", "container unit"],
    ["display: bogus", "invalid display value"],
    ["*width: 100px", "star hack property"],
    ["_height: 100px", "underscore hack property"],
    ["foo: bar", "unknown property"],
    ["color: url(https://x.com)", "url in color value"],
    ["transition: all 1s var(--ease)", "var() function"],
    ["padding-top: env(safe-area-inset-top)", "env() function"],
    ["width: attr(data-x)", "attr() function"],
    ["grid-template-columns: minmax(0, 100vw)", "viewport unit in grid"],
  ];

  for (const [css, label] of rejectedCases) {
    it(`rejects: ${css} (${label})`, () => {
      const result = sanitizeCSS(css);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBeTruthy();
    });
  }

  it("rejects input longer than the max length", () => {
    const long = `color: ${"a".repeat(MAX_CSS_LENGTH)};`;
    expect(sanitizeCSS(long).ok).toBe(false);
  });

  it("rejects when ANY single declaration is invalid (whole list fails)", () => {
    const result = sanitizeCSS("color: red; width: 100vw; padding: 8px");
    expect(result.ok).toBe(false);
  });
});

describe("sanitizeCSS — complexity limits (no CPU/memory abuse)", () => {
  it(`rejects more than ${MAX_DECLARATIONS} declarations`, () => {
    const many = Array.from({ length: MAX_DECLARATIONS }, (_, i) => `padding:${i}px`).join(";");
    const oneTooMany = many + ";color:red";
    expect(sanitizeCSS(many).ok).toBe(true);
    expect(sanitizeCSS(oneTooMany).ok).toBe(false);
  });

  it(`rejects values longer than ${MAX_VALUE_LENGTH} chars`, () => {
    const longValue = `box-shadow: 0 0 0 ${"1px ".repeat(120)}red`;
    expect(longValue.length).toBeGreaterThan(MAX_VALUE_LENGTH);
    const result = sanitizeCSS(longValue);
    expect(result.ok).toBe(false);
  });

  it(`rejects more than ${MAX_FUNCTION_COUNT} functions in a value`, () => {
    const overloaded = `filter: ${"blur(1px) ".repeat(MAX_FUNCTION_COUNT + 1)}saturate(1)`;
    expect(sanitizeCSS(overloaded).ok).toBe(false);
    const atLimit = `filter: ${"blur(1px) ".repeat(MAX_FUNCTION_COUNT - 1)}saturate(1)`;
    expect(sanitizeCSS(atLimit).ok).toBe(true);
  });

  it(`rejects function nesting deeper than ${MAX_FUNCTION_DEPTH}`, () => {
    const wrap = (n: number) =>
      `width: ${"calc(".repeat(n)}1px${")".repeat(n)}`;
    expect(sanitizeCSS(wrap(MAX_FUNCTION_DEPTH)).ok).toBe(true);
    expect(sanitizeCSS(wrap(MAX_FUNCTION_DEPTH + 1)).ok).toBe(false);
  });

  it("rejects !important everywhere, including on last declaration", () => {
    expect(sanitizeCSS("color: red !important; padding: 8px").ok).toBe(false);
    expect(sanitizeCSS("padding: 8px; color: red !important").ok).toBe(false);
  });
});

describe("validateDeclarationList — unexpected AST shapes fail closed", () => {
  it("rejects a node that is not a DeclarationList", () => {
    const result = validateDeclarationList({ type: "Raw" } as CssNode);
    expect(result.ok).toBe(false);
  });

  it("rejects a DeclarationList whose children contain an unknown node type", () => {
    const ast = {
      type: "DeclarationList",
      children: { forEach() {}, [Symbol.iterator]: function* () { yield { type: "MysteryNode" }; } },
    } as unknown as CssNode;
    expect(validateDeclarationList(ast).ok).toBe(false);
  });

  it("rejects a Declaration with a missing/non-string property", () => {
    const ast = {
      type: "DeclarationList",
      children: { forEach() {}, [Symbol.iterator]: function* () { yield { type: "Declaration" }; } },
    } as unknown as CssNode;
    expect(validateDeclarationList(ast).ok).toBe(false);
  });

  it("rejects a Declaration whose value is a string instead of an AST node", () => {
    const ast = {
      type: "DeclarationList",
      children: {
        forEach() {},
        [Symbol.iterator]: function* () {
          yield { type: "Declaration", property: "color", important: false, value: "red" };
        },
      },
    } as unknown as CssNode;
    expect(validateDeclarationList(ast).ok).toBe(false);
  });

  it("rejects a Declaration whose value is an unexpected node type", () => {
    const ast = {
      type: "DeclarationList",
      children: {
        forEach() {},
        [Symbol.iterator]: function* () {
          yield {
            type: "Declaration",
            property: "color",
            important: false,
            value: { type: "SelectorList" },
          };
        },
      },
    } as unknown as CssNode;
    expect(validateDeclarationList(ast).ok).toBe(false);
  });
});

describe("sanitizeCSS — serializer output never contains tag-breakout tokens", () => {
  it("asserts the invariant on every accepted input", () => {
    const outputs: string[] = [];
    for (const css of [
      "color: red",
      "font-family: Inter",
      "text-shadow: 0 0 1px #000",
      "transform: scale(1.1)",
      "background: linear-gradient(#fff, #000)",
    ]) {
      const result = sanitizeCSS(css);
      if (result.ok) outputs.push(result.css);
    }
    expect(outputs.length).toBeGreaterThan(0);
    for (const css of outputs) {
      expect(css).not.toMatch(/[<>]/);
      expect(css).not.toMatch(/<\/?style/i);
    }
  });
});

describe("customCSSToStyleMap", () => {
  it("maps valid declarations to camelCase React style keys", () => {
    const style = customCSSToStyleMap("color: red; padding: 8px; background-color: #fff");
    expect(style).toEqual({
      color: "red",
      padding: "8px",
      backgroundColor: "#fff",
    });
  });

  it("rejects !important at sanitize time (style map is never reached)", () => {
    const style = customCSSToStyleMap("color: red !important");
    expect(style).toEqual({});
  });

  it("returns an empty object for rejected payloads", () => {
    expect(customCSSToStyleMap("</style><script>alert(1)</script>")).toEqual({});
    expect(customCSSToStyleMap("position: fixed")).toEqual({});
    expect(customCSSToStyleMap("width: 100vw")).toEqual({});
    expect(customCSSToStyleMap("")).toEqual({});
  });

  it("round-trips through sanitizeCSS consistently", () => {
    const css = "color: red; padding: 8px";
    const sanitized = sanitizeCSS(css);
    expect(sanitized.ok).toBe(true);
    if (sanitized.ok) {
      expect(customCSSToStyleMap(sanitized.css)).toEqual(customCSSToStyleMap(css));
    }
  });
});
