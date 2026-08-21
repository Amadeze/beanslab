import { describe, it, expect } from "vitest";
import {
  normalizeTrackingEvent,
  normalizeTrackingResponse,
} from "./tracking";
import type { TrackingEvent } from "./tracking";

describe("normalizeTrackingEvent", () => {
  it("extracts timestamp from timestamp field", () => {
    const event = normalizeTrackingEvent({
      timestamp: "2026-08-21 10:30:00",
      description: "Package picked up",
      location: "Jakarta",
      status: "PICKED_UP",
    });
    expect(event.timestamp).toBe("2026-08-21 10:30:00");
    expect(event.description).toBe("Package picked up");
    expect(event.location).toBe("Jakarta");
    expect(event.status).toBe("PICKED_UP");
  });

  it("falls back to date field for timestamp", () => {
    const event = normalizeTrackingEvent({
      date: "2026-08-21",
      desc: "In transit",
    });
    expect(event.timestamp).toBe("2026-08-21");
    expect(event.description).toBe("In transit");
  });

  it("falls back to created_at field for timestamp", () => {
    const event = normalizeTrackingEvent({
      created_at: "2026-08-21T10:30:00Z",
      note: "Delivered to recipient",
    });
    expect(event.timestamp).toBe("2026-08-21T10:30:00Z");
    expect(event.description).toBe("Delivered to recipient");
  });

  it("returns null timestamp when none provided", () => {
    const event = normalizeTrackingEvent({ description: "Test" });
    expect(event.timestamp).toBeNull();
  });

  it("extracts location from city field", () => {
    const event = normalizeTrackingEvent({
      description: "Arrived",
      city: "Bandung",
    });
    expect(event.location).toBe("Bandung");
  });

  it("extracts location from division field", () => {
    const event = normalizeTrackingEvent({
      description: "Sorted",
      division: "Surabaya Hub",
    });
    expect(event.location).toBe("Surabaya Hub");
  });

  it("returns empty description when none provided", () => {
    const event = normalizeTrackingEvent({});
    expect(event.description).toBe("");
  });
});

describe("normalizeTrackingResponse", () => {
  it("normalizes a standard RajaOngkir response", () => {
    const result = normalizeTrackingResponse("AWB123", "jne", {
      summary: { status: "DELIVERED", delivered: true },
      details: [
        {
          timestamp: "2026-08-21 10:00:00",
          description: "Picked up",
          location: "Jakarta",
          status: "PICKED_UP",
        },
        {
          timestamp: "2026-08-22 14:00:00",
          description: "Delivered",
          location: "Bandung",
          status: "DELIVERED",
        },
      ],
    });

    expect(result.awb).toBe("AWB123");
    expect(result.courierCode).toBe("jne");
    expect(result.providerStatus).toBe("DELIVERED");
    expect(result.providerDelivered).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].description).toBe("Picked up");
    expect(result.events[1].description).toBe("Delivered");
    expect(result.lastRefreshedAt).toBeDefined();
  });

  it("handles response with no summary", () => {
    const result = normalizeTrackingResponse("AWB456", "jnt", {
      status: "IN_TRANSIT",
      delivered: false,
      details: [],
    });

    expect(result.providerStatus).toBe("IN_TRANSIT");
    expect(result.providerDelivered).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it("handles response with history instead of details", () => {
    const result = normalizeTrackingResponse("AWB789", "pos", {
      summary: { status: "TRANSIT" },
      history: [{ description: "Package in transit" }],
    });

    expect(result.providerStatus).toBe("TRANSIT");
    expect(result.events).toHaveLength(1);
  });

  it("handles empty/missing details array", () => {
    const result = normalizeTrackingResponse("AWB000", "tiki", {
      summary: { status: "UNKNOWN" },
    });

    expect(result.events).toHaveLength(0);
    expect(result.providerDelivered).toBe(false);
  });

  it("filters out non-object details", () => {
    const result = normalizeTrackingResponse("AWB111", "jne", {
      summary: { status: "OK" },
      details: ["string", null, 123, { description: "Valid event" }],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].description).toBe("Valid event");
  });
});
