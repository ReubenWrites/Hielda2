import { describe, it, expect } from "vitest"
import { parsePurchaseOrder, parseUkDate } from "../lib/parsePurchaseOrder"

describe("parseUkDate", () => {
  it("parses slash dates day-first", () => {
    expect(parseUkDate("14/03/2026")).toBe("2026-03-14")
    expect(parseUkDate("1/9/26")).toBe("2026-09-01")
    expect(parseUkDate("01-12-2025")).toBe("2025-12-01")
  })
  it("parses written dates", () => {
    expect(parseUkDate("3rd March 2026")).toBe("2026-03-03")
    expect(parseUkDate("14 Mar 2026")).toBe("2026-03-14")
    expect(parseUkDate("21st September, 2025")).toBe("2025-09-21")
  })
  it("rejects non-dates", () => {
    expect(parseUkDate("32/13/2026")).toBe(null)
    expect(parseUkDate("PO-12345")).toBe(null)
    expect(parseUkDate("")).toBe(null)
  })
})

describe("parsePurchaseOrder", () => {
  const TYPICAL_PO = [
    "Acme Media Group Ltd",
    "Unit 4, Riverside Business Park, Leeds LS1 4AB",
    "PURCHASE ORDER",
    "PO Number: PO-2026-0451",
    "Order date: 12/06/2026",
    "Supplier: Taylor Design Studio",
    "Item Description Qty Unit Price Total",
    "1 Homepage redesign concepts 1 1,200.00 1,200.00",
    "2 Design system documentation 1 850.00 850.00",
    "3 Stakeholder workshop facilitation 2 300.00 600.00",
    "Subtotal 2,650.00",
    "VAT (20%) 530.00",
    "Total 3,180.00",
  ]

  it("extracts line items with the last column as amount", () => {
    const r = parsePurchaseOrder(TYPICAL_PO)
    expect(r.lineItems).toHaveLength(3)
    expect(r.lineItems[0]).toEqual({ description: "Homepage redesign concepts", amount: "1200.00" })
    expect(r.lineItems[1]).toEqual({ description: "Design system documentation", amount: "850.00" })
    expect(r.lineItems[2]).toEqual({ description: "Stakeholder workshop facilitation", amount: "600.00" })
  })

  it("excludes subtotal/VAT/total summary rows", () => {
    const r = parsePurchaseOrder(TYPICAL_PO)
    const descs = r.lineItems.map((li) => li.description.toLowerCase())
    expect(descs.some((d) => /total|vat/.test(d))).toBe(false)
  })

  it("finds the PO number", () => {
    expect(parsePurchaseOrder(TYPICAL_PO).poNumber).toBe("PO-2026-0451")
  })

  it("finds the labelled order date", () => {
    expect(parsePurchaseOrder(TYPICAL_PO).poDate).toBe("2026-06-12")
  })

  it("takes the letterhead as the buyer name, skipping the doc heading", () => {
    expect(parsePurchaseOrder(TYPICAL_PO).clientName).toBe("Acme Media Group Ltd")
    const headingFirst = ["PURCHASE ORDER", "Bravo Consulting Ltd", "PO # BC-991", "Work: thing 100.00"]
    expect(parsePurchaseOrder(headingFirst).clientName).toBe("Bravo Consulting Ltd")
  })

  it("handles £ signs and single-amount lines", () => {
    const r = parsePurchaseOrder([
      "Ref: ABC/123",
      "Consultancy services — May £2,500.00",
    ])
    expect(r.lineItems).toEqual([{ description: "Consultancy services — May", amount: "2500.00" }])
    expect(r.poNumber).toBe("ABC/123")
  })

  it("ignores bare amounts and column fragments", () => {
    const r = parsePurchaseOrder(["1,200.00", "42", "£99.00"])
    expect(r.lineItems).toHaveLength(0)
  })

  it("does not mistake a date for a PO number", () => {
    const r = parsePurchaseOrder(["Order 12/06/2026", "Design work 500.00"])
    expect(r.poNumber).toBe(null)
  })

  it("returns empty result for empty input", () => {
    expect(parsePurchaseOrder([])).toEqual({ poNumber: null, poDate: null, clientName: null, lineItems: [] })
  })
})
