import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const dashboardRoot = path.join(process.cwd(), "src", "app", "(dashboard)");

function actionFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    if (statSync(target).isDirectory()) return actionFiles(target);
    return entry === "actions.ts" ? [target] : [];
  });
}

const mutationPrefixes = [
  "adjust",
  "approve",
  "calculate",
  "complete",
  "create",
  "distribute",
  "record",
  "update",
  "void",
];

describe("dashboard code safety", () => {
  it("scopes every dashboard raw SQL query to tenantId", () => {
    const files = actionFiles(dashboardRoot);
    let rawQueryCount = 0;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const queries = source.matchAll(/\$queryRaw(?:<[^`]+>)?`([\s\S]*?)`/g);
      for (const query of queries) {
        rawQueryCount += 1;
        expect(query[1], `${path.relative(process.cwd(), file)} contains unscoped raw SQL`)
          .toContain("tenantId");
      }
    }
    expect(rawQueryCount).toBeGreaterThan(0);
  });

  it("requires an explicit role guard in every dashboard mutation action", () => {
    for (const file of actionFiles(dashboardRoot)) {
      const source = readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );

      for (const statement of sourceFile.statements) {
        if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) continue;
        const isExported = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        );
        const isAsync = statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
        );
        const name = statement.name.text;
        if (
          !isExported
          || !isAsync
          || !mutationPrefixes.some((prefix) => name.startsWith(prefix))
        ) {
          continue;
        }

        expect(
          statement.body.getText(sourceFile),
          `${path.relative(process.cwd(), file)}:${name} is missing requireRole()`,
        ).toContain("requireRole(");
      }
    }
  });
});
