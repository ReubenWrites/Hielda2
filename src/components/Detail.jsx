import { useState, useEffect } from "react"
import { supabase } from "../supabase"
import { colors as c, MONO, RATE, CHASE_STAGES, DAILY_RATE, FONT } from "../constants"
import { daysLate, calcInterest, penalty, fmt, formatDate, addDays } from "../utils"
import { Card, Badge, Btn, ErrorBanner } from "./ui"
import { buildChaseEmail } from "../lib/emailTemplates"

export default function Detail({ inv, nav, profile, onUpdate }) {
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState("")
  const [downloading, setDownloading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState(null)
  const [chaseLogs, setChaseLogs] = useState([])
  const [autoChase, setAutoChase] = useState(inv?.auto_chase !== false)

  // Load chase logs for this invoice
  useEffect(() => {
    if (!inv?.id) return
    setAutoChase(inv.auto_chase !== false)
    supabase
      .from("chase_log")
      .select("*")
      .eq("invoice_id", inv.id)
      .order("sent_at", { ascending: false })
      .then(({ data }) => {
        if (data) setChaseLogs(data)
      })
  }, [inv?.id, inv?.auto_chase])

  if (!inv) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: c.tx, marginBottom: 4 }}>Invoice not found</div>
        <div style={{ fontSize: 13, color: c.tm, marginBottom: 16 }}>This invoice may have been deleted.</div>
        <Btn onClick={() => nav("dash")}>Back to Dashboard</Btn>
      </div>
    )
  }

  const dl = daysLate(inv.due_date)
  const ov = inv.status === "overdue"
  const interest = ov ? calcInterest(Number(inv.amount), dl) : 0
  const pen = ov ? penalty(Number(inv.amount)) : 0
  const ex = interest + pen
  const tot = Number(inv.amount) + ex
  const si = CHASE_STAGES.findIndex((s) => s.id === inv.chase_stage)

  const downloadPdf = async () => {
    setDownloading(true)
    setError("")
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-invoice-pdf", {
        body: { invoice_id: inv.id },
      })
      if (fnErr) throw fnErr
      const blob = new Blob([data], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${inv.ref}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError("PDF generation failed: " + e.message)
    }
    setDownloading(false)
  }

  const showEmailPreview = () => {
    const stage = inv.chase_stage || "reminder_1"
    const email = buildChaseEmail(inv, profile, stage)
    if (email) setPreviewHtml(email.html)
  }

  const markPaid = async () => {
    setMarking(true)
    setError("")
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0], chase_stage: null })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
      nav("dash")
    } catch (e) {
      setError("Failed to mark as paid: " + e.message)
    }
    setMarking(false)
  }

  const toggleAutoChase = async () => {
    const newVal = !autoChase
    setAutoChase(newVal)
    try {
      const { error: err } = await supabase
        .from("invoices")
        .update({ auto_chase: newVal })
        .eq("id", inv.id)
      if (err) throw err
      onUpdate()
    } catch (e) {
      setAutoChase(!newVal) // revert on error
      setError("Failed to update auto-chase: " + e.message)
    }
  }

  return (
    <div>
      <button onClick={() => nav("dash")} style={{ background: "none", border: "none", color: c.tm, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 18 }}>
        ← Back to Dashboard
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
            <h1 style={{ fontSize: 21, fontWeight: 700, color: c.tx, margin: 0 }}>{inv.ref}</h1>
            <Badge color={inv.status === "paid" ? c.gn : ov ? c.or : c.am}>
              {ov ? "being chased" : inv.status}
            </Badge>
          </div>
          <p style={{ color: c.tm, margin: 0, fontSize: 13 }}>{inv.client_name} · {inv.description}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn v="ghost" onClick={downloadPdf} dis={downloading} sz="sm">
            {downloading ? "Generating..." : "📥 PDF"}
          </Btn>
          {ov && (
            <Btn v="ghost" onClick={showEmailPreview} sz="sm">
              📧 Preview Email
            </Btn>
          )}
          {inv.status !== "paid" && (
            <Btn v="success" onClick={markPaid} dis={marking}>
              {marking ? "Marking..." : "✓ Mark as Paid"}
            </Btn>
          )}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      {ov && ex > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: c.god, border: `1px solid rgba(161,98,7,0.15)`, borderLeft: "3px solid #d4a017", borderRadius: "0 12px 12px 0", marginBottom: 18 }}>
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: c.go }}>Extra added by Hielda</span>
            <span style={{ fontSize: 12, color: c.tm, marginLeft: 8 }}>penalty + {dl}d interest</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: c.go, fontFamily: MONO }}>+{fmt(ex)}</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 22 }}>
        <Card>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Invoice details</h3>
          {[
            ["Client", inv.client_name],
            ["Email", inv.client_email],
            ["Original", fmt(inv.amount)],
            ["Issued", formatDate(inv.issue_date)],
            ["Terms", `${inv.payment_term_days} days`],
            ["Due", formatDate(inv.due_date)],
            inv.paid_date ? ["Paid", formatDate(inv.paid_date)] : null,
          ]
            .filter(Boolean)
            .map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <span style={{ color: c.tm, fontSize: 13 }}>{k}</span>
                <span style={{ color: c.tx, fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
        </Card>

        {ov && (
          <Card>
            <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>What they now owe you</h3>
            <div style={{ fontSize: 10, color: c.td, marginBottom: 12 }}>Late Payment of Commercial Debts (Interest) Act 1998</div>
            {[
              ["Original invoice", fmt(inv.amount), c.tx],
              ["Fixed penalty", `+${fmt(pen)}`, c.go],
              [`Interest (${dl}d)`, `+${fmt(interest)}`, c.go],
            ].map(([k, v, cl]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <span style={{ color: c.tm, fontSize: 12 }}>{k}</span>
                <span style={{ color: cl, fontSize: 13, fontFamily: MONO, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 10, borderTop: `2px solid ${c.ac}33` }}>
              <span style={{ color: c.tx, fontSize: 13, fontWeight: 700 }}>TOTAL NOW OWED</span>
              <span style={{ color: c.ac, fontSize: 20, fontWeight: 700, fontFamily: MONO }}>{fmt(tot)}</span>
            </div>
            <div style={{ fontSize: 10, color: c.td, marginTop: 5, textAlign: "right" }}>+{fmt(Number(inv.amount) * DAILY_RATE)}/day</div>
          </Card>
        )}

        {inv.status === "paid" && (
          <Card style={{ background: c.gnd, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 42, marginBottom: 10 }} aria-hidden="true">✓</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: c.gn }}>Paid</div>
            <div style={{ fontSize: 13, color: c.tm, marginTop: 4 }}>{formatDate(inv.paid_date)}</div>
          </Card>
        )}
      </div>

      <Card>
        <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 16px" }}>Chase timeline</h3>
        <p style={{ fontSize: 11, color: c.td, marginBottom: 14 }}>We check in with you before every step.</p>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 15, top: 20, bottom: 20, width: 2, background: c.bdl }} />
          {CHASE_STAGES.map((stg, idx) => {
            const act = stg.id === inv.chase_stage
            const past = si >= 0 && CHASE_STAGES.indexOf(stg) <= si
            return (
              <div key={stg.id} style={{ display: "flex", gap: 16, marginBottom: 16, position: "relative" }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: past ? stg.col : c.bg,
                    border: `2px solid ${past ? stg.col : c.bd}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: past ? c.w : c.td,
                    zIndex: 1,
                  }}
                >
                  {past ? "✓" : idx + 1}
                </div>
                <div style={{ flex: 1, paddingTop: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, color: past ? c.tx : c.td, fontSize: 13 }}>{stg.label}</span>
                    {act && <Badge color={stg.col}>Current</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: c.td }}>
                    {stg.dfd < 0 ? `${Math.abs(stg.dfd)}d before due` : stg.dfd === 0 ? "On due date" : `${stg.dfd}d after due`} · {formatDate(addDays(inv.due_date, stg.dfd))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Auto-chase toggle */}
      {inv.status !== "paid" && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", background: c.sf, border: `1px solid ${c.bd}`, borderRadius: 10, marginTop: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.tx }}>Automatic chasing</div>
            <div style={{ fontSize: 11, color: c.tm, marginTop: 2 }}>
              {autoChase ? "Hielda will send chase emails automatically" : "Chase emails paused for this invoice"}
            </div>
          </div>
          <button
            onClick={toggleAutoChase}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              border: "none",
              background: autoChase ? c.ac : c.bd,
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
            aria-label={autoChase ? "Disable automatic chasing" : "Enable automatic chasing"}
          >
            <div style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 3,
              left: autoChase ? 23 : 3,
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }} />
          </button>
        </div>
      )}

      {/* Chase log */}
      {chaseLogs.length > 0 && (
        <Card style={{ marginTop: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: c.tm, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 14px" }}>Chase log</h3>
          {chaseLogs.map((log) => {
            const stg = CHASE_STAGES.find((s) => s.id === log.chase_stage)
            return (
              <div key={log.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.bdl}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: stg?.col || c.ac, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: c.tx }}>{stg?.label || log.chase_stage}</div>
                    <div style={{ fontSize: 11, color: c.td }}>Sent to {log.email_to}</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: c.td }}>{formatDate(log.sent_at)}</div>
              </div>
            )
          })}
        </Card>
      )}

      {/* Email preview modal */}
      {previewHtml && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: c.sf, borderRadius: 14, width: 680, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${c.bd}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: c.tx }}>Chase Email Preview</span>
              <button onClick={() => setPreviewHtml(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: c.tm }}>×</button>
            </div>
            <iframe
              srcDoc={previewHtml}
              style={{ flex: 1, border: "none", minHeight: 400 }}
              title="Email preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}
