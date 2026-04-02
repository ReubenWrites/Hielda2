import { useMemo } from "react"
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { fmt, formatDate, daysLate } from "../utils"
import { Card } from "./ui"
import s from "./Analytics.module.css"

export default function Analytics({ invs, isMobile }) {
  // 1. Overdue amounts over last 90 days
  const overdueOverTime = useMemo(() => {
    const now = new Date()
    const data = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split("T")[0]
      let total = 0
      for (const inv of invs) {
        if (inv.due_date <= dateStr && (!inv.paid_date || inv.paid_date > dateStr) && inv.status !== "paid") {
          total += Number(inv.amount) || 0
        }
      }
      data.push({ date: dateStr, amount: Math.round(total * 100) / 100 })
    }
    return data
  }, [invs])

  // 2. Chase success rate — invoices that got paid vs still outstanding
  const chaseSuccess = useMemo(() => {
    const chased = invs.filter((i) => i.chase_stage && i.chase_stage !== "reminder_1")
    const paid = chased.filter((i) => i.status === "paid")
    const overdue = chased.filter((i) => i.status === "overdue")
    const pending = chased.filter((i) => i.status === "pending")
    return [
      { name: "Paid", count: paid.length, color: "#16a34a" },
      { name: "Overdue", count: overdue.length, color: "#d97706" },
      { name: "Pending", count: pending.length, color: "#b45309" },
    ].filter((d) => d.count > 0)
  }, [invs])

  // 3. Average days to payment (monthly trend)
  const avgDaysToPayment = useMemo(() => {
    const paid = invs.filter((i) => i.status === "paid" && i.paid_date && i.issue_date)
    const byMonth = {}
    for (const inv of paid) {
      const month = inv.paid_date.slice(0, 7) // YYYY-MM
      const days = Math.round((new Date(inv.paid_date) - new Date(inv.issue_date)) / 86400000)
      if (!byMonth[month]) byMonth[month] = { total: 0, count: 0 }
      byMonth[month].total += days
      byMonth[month].count++
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, { total, count }]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        avgDays: Math.round(total / count),
      }))
  }, [invs])

  // 4. Invoice volume by month (stacked by status)
  const invoiceVolume = useMemo(() => {
    const byMonth = {}
    for (const inv of invs) {
      const month = inv.created_at.slice(0, 7)
      if (!byMonth[month]) byMonth[month] = { paid: 0, overdue: 0, pending: 0 }
      if (inv.status === "paid") byMonth[month].paid++
      else if (inv.status === "overdue") byMonth[month].overdue++
      else byMonth[month].pending++
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        ...data,
      }))
  }, [invs])

  // Summary stats
  const totalPaid = invs.filter((i) => i.status === "paid")
  const avgPayDays = totalPaid.length > 0
    ? Math.round(totalPaid.filter((i) => i.paid_date && i.issue_date).reduce((sum, i) => sum + (new Date(i.paid_date) - new Date(i.issue_date)) / 86400000, 0) / totalPaid.length)
    : 0
  const currentOverdue = invs.filter((i) => i.status === "overdue")
  const totalOverdueAmount = currentOverdue.reduce((s, i) => s + (Number(i.amount) || 0), 0)

  return (
    <div>
      <div className={s.header}>
        <h1 className={s.title}>Analytics</h1>
        <p className={s.subtitle}>Payment performance and trends</p>
      </div>

      {/* Summary cards */}
      <div className={s.summaryGrid}>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Total Invoices</div>
          <div className={s.summaryValue}>{invs.length}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Avg Days to Payment</div>
          <div className={s.summaryValue}>{avgPayDays || "—"}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Currently Overdue</div>
          <div className={s.summaryValue} data-alert={currentOverdue.length > 0 ? "true" : undefined}>{fmt(totalOverdueAmount)}</div>
        </div>
        <div className={s.summaryCard}>
          <div className={s.summaryLabel}>Collection Rate</div>
          <div className={s.summaryValue}>{invs.length > 0 ? Math.round((totalPaid.length / invs.length) * 100) : 0}%</div>
        </div>
      </div>

      {/* Charts */}
      <div className={s.chartGrid}>
        <Card>
          <h3 className={s.chartTitle}>Overdue Amounts (Last 90 Days)</h3>
          {overdueOverTime.some((d) => d.amount > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={overdueOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} interval={14} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(v) => `£${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
                <Tooltip formatter={(v) => [fmt(v), "Overdue"]} labelFormatter={(v) => formatDate(v)} />
                <Area type="monotone" dataKey="amount" stroke="#d97706" fill="#d9770620" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={s.emptyChart}>No overdue data in the last 90 days</div>
          )}
        </Card>

        <Card>
          <h3 className={s.chartTitle}>Chase Outcomes</h3>
          {chaseSuccess.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chaseSuccess} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chaseSuccess.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={s.emptyChart}>No chased invoices yet</div>
          )}
        </Card>

        <Card>
          <h3 className={s.chartTitle}>Avg Days to Payment</h3>
          {avgDaysToPayment.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avgDaysToPayment} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="d" />
                <Tooltip formatter={(v) => [`${v} days`, "Avg"]} />
                <Bar dataKey="avgDays" fill="#1e5fa0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={s.emptyChart}>No paid invoices yet</div>
          )}
        </Card>

        <Card>
          <h3 className={s.chartTitle}>Invoice Volume by Month</h3>
          {invoiceVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={invoiceVolume} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eceef3" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="paid" stackId="a" fill="#16a34a" name="Paid" />
                <Bar dataKey="overdue" stackId="a" fill="#d97706" name="Overdue" />
                <Bar dataKey="pending" stackId="a" fill="#b45309" name="Pending" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={s.emptyChart}>No invoices yet</div>
          )}
        </Card>
      </div>
    </div>
  )
}
