import { useState, useMemo } from "react"
import { colors as c, FONT, MONO, CHASE_STAGES } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate } from "../utils"
import { Card, Badge, Btn, StatCard } from "./ui"

export default function Dashboard({ invs, nav }) {
  const [search, setSearch] = useState("")

  const { overdue, pending, paid, totExtra, totOwed } = useMemo(() => {
    const overdue = invs.filter((i) => i.status === "overdue")
    const pending = invs.filter((i) => i.status === "pending")
    const paid = invs.filter((i) => i.status === "paid")

    const totExtra = overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0)

    const totOwed = overdue.reduce((s, i) => {
      const dl = daysLate(i.due_date)
      return s + Number(i.amount) + calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
    }, 0)

    return { overdue, pending, paid, totExtra, totOwed }
  }, [invs])

  const filtered = useMemo(() => {
    if (!search) return invs
    const q = search.toLowerCase()
    return invs.filter((i) =>
      [i.client_name, i.ref, i.description, String(i.amount)].some(
        (s) => s && s.toLowerCase().includes(q)
      )
    )
  }, [invs, search])

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: c.tx, margin: 0 }}>Dashboard</h1>
        <p style={{ color: c.tm, margin: "5px 0 0", fontSize: 13 }}>
          Your payment overview for {formatDate(new Date())}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 24 }}>
        <StatCard label="Extra by Hielda" value={`+${fmt(totExtra)}`} sub="penalties + interest" color={c.go} borderColor="#d4a017" />
        <StatCard label="Being chased" value={fmt(totOwed)} sub={`${overdue.length} invoice${overdue.length !== 1 ? "s" : ""}`} color={c.or} borderColor="#d97706" />
        <StatCard label="Pending" value={fmt(pending.reduce((s, i) => s + Number(i.amount), 0))} sub={`${pending.length} not yet due`} color={c.am} borderColor="#b45309" />
        <StatCard label="Paid (90 days)" value={fmt(paid.reduce((s, i) => s + Number(i.amount), 0))} sub={`${paid.length} invoice${paid.length !== 1 ? "s" : ""}`} color={c.gn} borderColor="#1e5fa0" />
      </div>

      {overdue.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ position: "relative", width: 8, height: 8 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: c.ac }} />
              <div className="pulse-ring" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: c.ac }}>Hielda is chasing these</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overdue.map((i) => {
              const dl = daysLate(i.due_date)
              const ex = calcInterest(Number(i.amount), dl) + penalty(Number(i.amount))
              const stg = CHASE_STAGES.find((s) => s.id === i.chase_stage)
              return (
                <Card key={i.id} onClick={() => nav("detail", i.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: c.acd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }} aria-hidden="true">
                      🛡️
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: c.tx, fontSize: 13 }}>{i.client_name || "Client"}</div>
                      <div style={{ fontSize: 11, color: c.tm, marginTop: 1 }}>{i.ref} · {i.description}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 600, color: c.tx, fontFamily: MONO, fontSize: 14 }}>{fmt(Number(i.amount) + ex)}</div>
                      <div style={{ fontSize: 10, color: c.go, fontWeight: 600, marginTop: 1 }}>+{fmt(ex)} extra</div>
                    </div>
                    {stg && <Badge color={stg.col}>{stg.label}</Badge>}
                    <span style={{ color: c.td, fontSize: 15 }} aria-hidden="true">→</span>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: c.tx, margin: 0 }}>All invoices</h2>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search invoices"
              style={{
                width: "100%",
                maxWidth: 280,
                padding: "7px 12px",
                background: c.bg,
                border: `1px solid ${c.bd}`,
                borderRadius: 8,
                fontFamily: FONT,
                fontSize: 12,
                color: c.tx,
                outline: "none",
              }}
            />
          </div>
          <Btn sz="sm" onClick={() => nav("create")}>+ New Invoice</Btn>
        </div>

        {invs.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }} aria-hidden="true">📋</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 4 }}>No invoices yet</div>
            <div style={{ fontSize: 13, color: c.tm, marginBottom: 16 }}>Create your first invoice and Hielda will handle the rest.</div>
            <Btn onClick={() => nav("create")}>+ Create Invoice</Btn>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${c.bd}`, background: "#f8f9fb" }}>
                  {["Ref", "Client", "Amount", "Extra", "Total", "Due", "Status"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: c.tm, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                  <th style={{ width: 30 }}><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "24px 12px", textAlign: "center", color: c.tm, fontSize: 13 }}>
                      No invoices match your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((i) => {
                    const dl = daysLate(i.due_date)
                    const ex = i.status === "overdue" ? calcInterest(Number(i.amount), dl) + penalty(Number(i.amount)) : 0
                    return (
                      <tr
                        key={i.id}
                        style={{ borderBottom: `1px solid ${c.bdl}`, cursor: "pointer" }}
                        onClick={() => nav("detail", i.id)}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") nav("detail", i.id) }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: "10px 12px", fontFamily: MONO, fontSize: 11, color: c.td }}>{i.ref}</td>
                        <td style={{ padding: "10px 12px", color: c.tx, fontWeight: 500 }}>{i.client_name || "—"}</td>
                        <td style={{ padding: "10px 12px", fontFamily: MONO }}>{fmt(i.amount)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600, color: ex > 0 ? c.go : c.td }}>
                          {ex > 0 ? `+${fmt(ex)}` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: MONO, fontWeight: 600 }}>{fmt(Number(i.amount) + ex)}</td>
                        <td style={{ padding: "10px 12px", color: c.tm }}>{formatDate(i.due_date)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <Badge color={i.status === "paid" ? c.gn : i.status === "overdue" ? c.or : c.am}>
                            {i.status === "overdue" ? "being chased" : i.status}
                          </Badge>
                        </td>
                        <td style={{ padding: "10px 12px", color: c.td }} aria-hidden="true">→</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  )
}
