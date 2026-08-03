// Minimal type declarations for css-tree v3 (the package ships no bundled
// types and the community @types package targets the v2 API).
//
// The shim avoids `any` and keeps the AST nodes discriminated by their
// `type` string. The sanitizer does NOT trust these types: every node used at
// runtime is shape-checked (typeof checks, `type` membership checks) and any
// node type not explicitly handled fails closed.

declare module "css-tree" {
  export interface CssNode {
    type: string;
    loc: null | unknown;
    children?: CssNodeList;
    property?: string;
    value?: CssNode | string;
    important?: boolean;
    name?: string;
    unit?: string;
  }

  export interface Declaration extends CssNode {
    type: "Declaration";
    property: string;
    important: boolean;
    value: CssNode;
  }

  export interface CssNodeList {
    forEach(cb: (node: CssNode) => void): void;
    [Symbol.iterator](): Iterator<CssNode>;
  }

  export interface ParseOptions {
    context?: "declarationList" | "value" | "selectorList" | "stylesheet";
    positions?: boolean;
  }

  export interface WalkOptions {
    enter?: (node: CssNode) => void;
    leave?: (node: CssNode) => void;
  }

  export function parse(input: string, options?: ParseOptions): CssNode;
  export function generate(node: CssNode): string;
  export function walk(node: CssNode, options: WalkOptions): void;
  export function walk(node: CssNode, fn: (node: CssNode) => void): void;

  export const lexer: {
    matchDeclaration(node: Declaration): { error?: { message: string } };
  };
}
