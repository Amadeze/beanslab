import { describe, expect, it } from "vitest";

import { parseLegacyStockFile } from "./parser";

const CSV_HEADER = "type,code,name,quantity,unitCost";

function buildCsv(rows: string[]): Buffer {
  const body = rows.join("\n");
  return Buffer.from(`${CSV_HEADER}\n${body}\n`, "utf-8");
}

describe("parseLegacyStockFile (CSV)", () => {
  it("parses a valid CSV with correct row count", () => {
    const buffer = buildCsv([
      "GREEN_BEAN,GB-001,Arabica Beans,25,12000",
      "SUPPLY,SUP-001,Bags,100,500",
    ]);
    const result = parseLegacyStockFile(buffer, "stock.csv");
    expect(result.errors).toHaveLength(0);
    expect(result.rowCount).toBe(2);
    expect(result.rawRows[0].type).toBe("GREEN_BEAN");
    expect(result.rawRows[1].code).toBe("SUP-001");
  });

  it("returns error for empty file", () => {
    const result = parseLegacyStockFile(Buffer.from("", "utf-8"), "empty.csv");
    expect(result.rawRows).toHaveLength(0);
    expect(result.errors).toContain("Empty file");
  });

  it("returns error for missing required columns", () => {
    const buffer = Buffer.from("type,code,name\nGB-001,Arabica\n", "utf-8");
    const result = parseLegacyStockFile(buffer, "bad.csv");
    expect(result.errors).toContain(
      "Missing required columns: name, quantity, unitCost"
    );
  });

  it("handles extra columns by including them in raw rows", () => {
    const buffer = Buffer.from(
      "type,code,name,quantity,unitCost,extra1,extra2\nGREEN_BEAN,GB-1,Bean,10,100,foo,bar\n",
      "utf-8"
    );
    const result = parseLegacyStockFile(buffer, "extra.csv");
    expect(result.rawRows[0].extra1).toBe("foo");
  });

  it("respects maxRows option", () => {
    const rows: string[] = [];
    for (let i = 0; i < 10; i++) {
      rows.push(`GREEN_BEAN,GB-${i},Bean ${i},${i + 1},1000`);
    }
    const buffer = buildCsv(rows);
    const result = parseLegacyStockFile(buffer, "many.csv", { maxRows: 5 });
    expect(result.rowCount).toBe(5);
  });
});
