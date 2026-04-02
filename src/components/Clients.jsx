import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import { fmt, formatDate } from "../utils"
import { Btn, Inp, Card, Badge, ErrorBanner } from "./ui"
import s from "./Clients.module.css"

export default function Clients({ userId, invs, isMobile }) {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editData, setEditData] = useState({})
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [synced, setSynced] = useState(false)

  const load = async () => {
    if (!userId) return
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("name")
    if (data) setClients(data)
    setLoading(false)
  }

  // Auto-sync clients from existing invoices on first load if table is empty
  const syncFromInvoices = async () => {
    if (!userId || !invs.length || synced) return
    setSynced(true)
    const { data: existing } = await supabase
      .from("clients")
      .select("email")
      .eq("user_id", userId)
    if (existing && existing.length > 0) return // Already has clients

    // Deduplicate by email, take most recent name/address
    const byEmail = {}
    for (const inv of invs) {
      if (!inv.client_email) continue
      if (!byEmail[inv.client_email] || new Date(inv.created_at) > new Date(byEmail[inv.client_email].created_at)) {
        byEmail[inv.client_email] = inv
      }
    }

    const rows = Object.values(byEmail).map((inv) => ({
      user_id: userId,
      name: inv.client_name || inv.client_email,
      email: inv.client_email,
      address: inv.client_address || null,
    }))

    if (rows.length > 0) {
      await supabase.from("clients").upsert(rows, { onConflict: "user_id,email" })
      load()
    }
  }

  useEffect(() => { load() }, [userId])
  useEffect(() => { if (!loading && clients.length === 0) syncFromInvoices() }, [loading])

  // Compute per-client invoice stats
  const clientStats = useMemo(() => {
    const map = {}
    for (const inv of invs) {
      if (!inv.client_email) continue
      if (!map[inv.client_email]) {
        map[inv.client_email] = { total: 0, outstanding: 0, count: 0, lastDate: null }
      }
      const st = map[inv.client_email]
      st.count++
      st.total += Number(inv.amount) || 0
      if (inv.status === "overdue" || inv.status === "pending") {
        st.outstanding += Number(inv.amount) || 0
      }
      if (!st.lastDate || inv.created_at > st.lastDate) {
        st.lastDate = inv.created_at
      }
    }
    return map
  }, [invs])

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  const saveEdit = async () => {
    if (!editData.name || !editData.email) {
      setError("Name and email are required.")
      return
    }
    setSaving(true)
    setError("")
    const { error: dbErr } = await supabase
      .from("clients")
      .update({ name: editData.name, email: editData.email, address: editData.address, notes: editData.notes, updated_at: new Date().toISOString() })
      .eq("id", editing)
    if (dbErr) setError(dbErr.message)
    else { setEditing(null); load() }
    setSaving(false)
  }

  const deleteClient = async (id) => {
    if (!confirm("Delete this client? Their invoices won't be affected.")) return
    await supabase.from("clients").delete().eq("id", id)
    setExpanded(null)
    load()
  }

  const clientInvoices = (email) => invs.filter((i) => i.client_email === email)

  if (loading) return <div className={s.loading}>Loading clients...</div>

  return (
    <div>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Clients</h1>
          <p className={s.subtitle}>{clients.length} client{clients.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError("")} />

      <div className={s.searchBar}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className={s.searchInput}
        />
      </div>

      {filtered.length === 0 ? (
        <div className={s.empty}>
          {clients.length === 0
            ? "No clients yet. They'll appear automatically when you create invoices."
            : "No clients match your search."}
        </div>
      ) : (
        <div className={s.list}>
          {filtered.map((client) => {
            const stats = clientStats[client.email] || { count: 0, total: 0, outstanding: 0, lastDate: null }
            const isExpanded = expanded === client.id
            const isEditing = editing === client.id

            return (
              <Card key={client.id} style={{ marginBottom: 8 }}>
                <button
                  className={s.clientRow}
                  onClick={() => { setExpanded(isExpanded ? null : client.id); setEditing(null) }}
                >
                  <div className={s.clientMain}>
                    <div className={s.clientName}>{client.name}</div>
                    <div className={s.clientEmail}>{client.email}</div>
                  </div>
                  <div className={s.clientStats}>
                    <span className={s.statItem}>{stats.count} invoice{stats.count !== 1 ? "s" : ""}</span>
                    {stats.outstanding > 0 && (
                      <Badge color="#d97706">{fmt(stats.outstanding)} outstanding</Badge>
                    )}
                  </div>
                  <span className={s.arrow} data-open={isExpanded ? "true" : undefined}>▼</span>
                </button>

                {isExpanded && (
                  <div className={s.expandedContent}>
                    {isEditing ? (
                      <div className={s.editForm}>
                        <Inp label="Name" value={editData.name || ""} onChange={(v) => setEditData({ ...editData, name: v })} />
                        <Inp label="Email" value={editData.email || ""} onChange={(v) => setEditData({ ...editData, email: v })} />
                        <Inp label="Address" value={editData.address || ""} onChange={(v) => setEditData({ ...editData, address: v })} ta />
                        <Inp label="Notes" value={editData.notes || ""} onChange={(v) => setEditData({ ...editData, notes: v })} ta />
                        <div className={s.editActions}>
                          <Btn onClick={saveEdit} dis={saving} sz="sm">{saving ? "Saving..." : "Save"}</Btn>
                          <Btn v="ghost" onClick={() => setEditing(null)} sz="sm">Cancel</Btn>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={s.detailGrid}>
                          {client.address && <div className={s.detailItem}><span className={s.detailLabel}>Address</span><span>{client.address}</span></div>}
                          {client.notes && <div className={s.detailItem}><span className={s.detailLabel}>Notes</span><span>{client.notes}</span></div>}
                          <div className={s.detailItem}><span className={s.detailLabel}>Total billed</span><span>{fmt(stats.total)}</span></div>
                          {stats.lastDate && <div className={s.detailItem}><span className={s.detailLabel}>Last invoice</span><span>{formatDate(stats.lastDate)}</span></div>}
                        </div>
                        <div className={s.detailActions}>
                          <Btn sz="sm" onClick={() => { setEditing(client.id); setEditData(client) }}>Edit</Btn>
                          <Btn v="danger" sz="sm" onClick={() => deleteClient(client.id)}>Delete</Btn>
                        </div>

                        {/* Invoice history */}
                        {clientInvoices(client.email).length > 0 && (
                          <div className={s.invoiceHistory}>
                            <h4 className={s.historyTitle}>Invoice History</h4>
                            {clientInvoices(client.email).slice(0, 10).map((inv) => (
                              <button
                                key={inv.id}
                                onClick={() => navigate(`/invoice/${inv.id}`)}
                                className={s.invoiceRow}
                              >
                                <span className={s.invoiceRef}>{inv.ref}</span>
                                <span>{fmt(inv.amount)}</span>
                                <Badge color={inv.status === "paid" ? "#16a34a" : inv.status === "overdue" ? "#d97706" : "#b45309"}>{inv.status}</Badge>
                                <span className={s.invoiceDate}>{formatDate(inv.created_at)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
