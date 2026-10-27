import { describe, it, expect } from "vitest";
import { billTotal, indoorTotals, inr } from "@/lib/billing";

describe("billing rules", () => {
  it("regular total = manual + sum(qty x mrp)", () => {
    expect(billTotal(100, [{ name: "A", quantity: 2, mrp: 25.5 }, { name: "B", quantity: 1, mrp: 10 }])).toBe(161);
  });
  it("products are optional", () => {
    expect(billTotal(250, [])).toBe(250);
  });
  it("indoor final and balance", () => {
    expect(indoorTotals(1000, 200, 500)).toEqual({ final: 1200, balance: 700, status: "Partial" });
  });
  it("paid when balance <= 0", () => {
    expect(indoorTotals(1000, 0, 1000).status).toBe("Paid");
  });
  it("unpaid when nothing paid", () => {
    expect(indoorTotals(1000, 0, 0).status).toBe("Unpaid");
  });
  it("formats rupees", () => {
    expect(inr(1250)).toBe("₹1,250.00");
  });
});
