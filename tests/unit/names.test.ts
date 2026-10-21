import { describe, expect, it } from "vitest";
import { defaultAddressForm, polishVocative } from "@/lib/names";

describe("Polish vocative", () => {
  it.each([
    ["Marek", "Marku"],
    ["Anna", "Anno"],
    ["Tomasz", "Tomaszu"],
    ["Piotr", "Piotrze"],
    ["Kasia", "Kasiu"],
    ["Ania", "Aniu"],
    ["Michał", "Michale"],
    ["Paweł", "Pawle"],
    ["Natalia", "Natalio"],
    ["Monika", "Moniko"],
    ["Adam", "Adamie"],
    ["Robert", "Robercie"],
    ["Dawid", "Dawidzie"],
    ["Karol", "Karolu"],
    ["Maja", "Maju"],
    ["Jakub", "Jakubie"],
    ["Dominik", "Dominiku"],
    ["Antoni", "Antoni"],
  ])("%s → %s", (name, vocative) => {
    expect(polishVocative(name)).toBe(vocative);
  });

  it("only applies to Polish recordings", () => {
    expect(defaultAddressForm("Marek", "pl")).toBe("Marku");
    expect(defaultAddressForm("Marek", "en")).toBe("Marek");
    expect(defaultAddressForm("Marek", "es")).toBe("Marek");
  });
});
