import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoffeeOfferingCard } from "@/components/storefront/CoffeeOfferingCard";
import type { StorefrontOffering } from "@/lib/storefront-grind";

describe("storefront coffee identity", () => {
  it("renders public coffee facts from the tenant offering instead of theme claims", () => {
    const offering: StorefrontOffering = {
      id: "offering-1",
      code: "ETH-GUJ-01",
      name: "Guji Shakiso",
      description: "Rilis musiman tenant.",
      imageUrl: null,
      roastLevel: "LIGHT",
      grindOptions: ["WHOLE_BEAN"],
      allowCustomGrind: false,
      lineageProductId: "rb-1",
      availableKg: 8,
      unavailableReason: null,
      coffeeSource: {
        name: "Shakiso washing station",
        country: "Ethiopia",
        region: "Guji",
        farm: "Shakiso",
        varietal: "Heirloom",
        species: "Arabica",
        processMethod: "Natural",
        fermentationMethod: "Anaerobic 48h",
        elevation: "1,950–2,100 masl",
        cropYear: "2026",
        certifications: ["Organic"],
        tastingNotes: "Jasmine, peach, bergamot",
      },
      variants: [{ id: "250g", packageName: "Pouch 250 g", netWeightGrams: 250, unitPrice: 165000 }],
    };

    const html = renderToStaticMarkup(createElement(CoffeeOfferingCard, {
      offering,
      preview: true,
      appearance: "field_cards",
    }));

    for (const fact of ["Ethiopia", "Guji", "Shakiso", "Arabica", "Heirloom", "Natural", "Anaerobic 48h", "1,950–2,100 masl", "2026", "Organic", "Jasmine, peach, bergamot"]) {
      expect(html).toContain(fact);
    }
    expect(html).toContain("Detail kopi");
    expect(html).not.toContain("85+ SCA");
    expect(html).not.toContain("direct trade");
  });
});
