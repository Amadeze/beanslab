import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseAlog, isAlogFile } from "../parser";

const fixturesDir = join(__dirname, "fixtures");

describe("Artisan .alog parser", () => {
  describe("XML format (dummy/test)", () => {
    it("parses a valid .alog file", () => {
      const buffer = readFileSync(join(fixturesDir, "sample-roast.alog"));
      const result = parseAlog(buffer, "sample-roast.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      const { data } = result;
      expect(data.source).toBe("artisan");
      expect(data.title).toBe("Gayo Heavy Roast");
      expect(data.chargeTime).toBe(90); // 01:30
      expect(data.dropTime).toBe(825); // 13:45
      expect(data.durationSeconds).toBe(735); // 12:15
      expect(data.chargeTemperature).toBe(195.2);
      expect(data.dropTemperature).toBe(215.3);
    });

    it("extracts temperature series", () => {
      const buffer = readFileSync(join(fixturesDir, "sample-roast.alog"));
      const result = parseAlog(buffer, "sample-roast.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.beanTemperatureSeries.length).toBeGreaterThan(50);
      expect(result.data.environmentalTemperatureSeries.length).toBeGreaterThan(50);
      expect(result.data.beanTemperatureSeries[0]).toEqual({ second: 0, value: 22.1 });
    });

    it("extracts events", () => {
      const buffer = readFileSync(join(fixturesDir, "sample-roast.alog"));
      const result = parseAlog(buffer, "sample-roast.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      const eventTypes = result.data.events.map((e) => e.type);
      expect(eventTypes).toContain("CHARGE");
      expect(eventTypes).toContain("TP");
      expect(eventTypes).toContain("FCs");
      expect(eventTypes).toContain("FCe");
      expect(eventTypes).toContain("SCs");
      expect(eventTypes).toContain("DROP");
    });

    it("extracts first crack timing from events", () => {
      const buffer = readFileSync(join(fixturesDir, "sample-roast.alog"));
      const result = parseAlog(buffer, "sample-roast.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // First crack timing is extracted from events in XML format
      const fcsEvent = result.data.events.find((e) => e.type === "FCs");
      const fceEvent = result.data.events.find((e) => e.type === "FCe");
      const scsEvent = result.data.events.find((e) => e.type === "SCs");

      expect(fcsEvent).toBeDefined();
      expect(fcsEvent!.second).toBe(560); // 09:20
      expect(fceEvent).toBeDefined();
      expect(fceEvent!.second).toBe(605); // 10:05
      expect(scsEvent).toBeDefined();
      expect(scsEvent!.second).toBe(690); // 11:30
    });

    it("extracts metadata from XML", () => {
      const buffer = readFileSync(join(fixturesDir, "sample-roast.alog"));
      const result = parseAlog(buffer, "sample-roast.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // XML parser extracts weight from attributes
      expect(result.data.metadata.greenWeightGrams).toBe(200);
      expect(result.data.metadata.roastedWeightGrams).toBe(168);
      expect(result.data.metadata.lossPercent).toBe(16);
    });
  });

  describe("Real Artisan Python dict format", () => {
    it("parses real .alog file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      const { data } = result;
      expect(data.source).toBe("artisan");
      expect(data.title).toBe("Ethiopia Dry Process Hambela Goro");
      expect(data.sourceVersion).toBe("2.10.4");
    });

    it("extracts temperature curves from real file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Should have temperature data
      expect(result.data.beanTemperatureSeries.length).toBeGreaterThan(100);
      expect(result.data.environmentalTemperatureSeries.length).toBeGreaterThan(100);

      // First point should be near time 0
      expect(result.data.beanTemperatureSeries[0].second).toBeCloseTo(0.87, 0);

      // Temps should be converted from F to C (original ~83F → ~28C)
      expect(result.data.beanTemperatureSeries[0].value).toBeLessThan(50);
      expect(result.data.beanTemperatureSeries[0].value).toBeGreaterThan(20);
    });

    it("converts Fahrenheit to Celsius", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Original BT at CHARGE is ~82.2F → should be ~27.9C
      const chargeTemp = result.data.chargeTemperature;
      expect(chargeTemp).toBeDefined();
      expect(chargeTemp!).toBeLessThan(50);
      expect(chargeTemp!).toBeGreaterThan(20);

      // Original DROP BT is ~461.5F → should be ~238.6C
      const dropTemp = result.data.dropTemperature;
      expect(dropTemp).toBeDefined();
      expect(dropTemp!).toBeGreaterThan(200);
      expect(dropTemp!).toBeLessThan(260);
    });

    it("extracts events from real file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      const eventTypes = result.data.events.map((e) => e.type);
      expect(eventTypes).toContain("CHARGE");
      expect(eventTypes).toContain("FCs");
      expect(eventTypes).toContain("DROP");
      expect(eventTypes).toContain("TP");
    });

    it("extracts timing from real file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Total time should be ~418 seconds
      expect(result.data.durationSeconds).toBeCloseTo(418, 0);

      // FCs time should be ~324 seconds
      expect(result.data.firstCrackStartTime).toBeCloseTo(324, 0);
    });

    it("extracts weight from real file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.metadata.greenWeightGrams).toBe(110.2);
      expect(result.data.metadata.roastedWeightGrams).toBe(94.5);
      expect(result.data.metadata.lossPercent).toBeCloseTo(14.2, 0);
    });

    it("extracts metadata from real file", () => {
      const buffer = readFileSync(join(fixturesDir, "sweet-marias-real.alog"));
      const result = parseAlog(buffer, "sweet-marias-real.alog");

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.metadata.roaster).toBe("Phidget 2xTC on Popper");
      expect(result.data.metadata.organization).toBe("Sweet Maria's Coffee");
      expect(result.data.metadata.mode).toBe("F");
      expect(result.data.metadata.ambientTemp).toBe(85.8);
    });
  });

  describe("Error handling", () => {
    it("rejects non-alog content", () => {
      const buffer = Buffer.from("This is not an XML file");
      const result = parseAlog(buffer, "test.alog");

      expect(result.success).toBe(false);
      if (result.success) return;
      // Plain text doesn't start with { or <?xml or <roast
      expect(result.errorCode).toBe("UNSUPPORTED_ALOG_VERSION");
    });

    it("handles XML without roast element gracefully", () => {
      const buffer = Buffer.from('<?xml version="1.0"?><data><item>test</item></data>');
      const result = parseAlog(buffer, "test.alog");

      // XML parser returns success even without roast data (backward compatible)
      expect(result.success).toBe(true);
      if (!result.success) return;
      // Parser extracts whatever tags it finds
      expect(result.data.beanTemperatureSeries).toHaveLength(0);
      expect(result.data.events).toHaveLength(0);
    });
  });

  describe("isAlogFile", () => {
    it("validates extension", () => {
      expect(isAlogFile("roast.alog")).toBe(true);
      expect(isAlogFile("ROAST.ALOG")).toBe(true);
      expect(isAlogFile("roast.xml")).toBe(false);
      expect(isAlogFile("roast.txt")).toBe(false);
    });
  });
});
