import { useState, useEffect, useRef } from "react"
import { supabase } from "../supabase"
import s from "./ClientPicker.module.css"

export default function ClientPicker({ userId, onSelect, currentEmail }) {
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    supabase
      .from("clients")
      .select("*")
      .eq("user_id", userId)
      .order("name")
      .then(({ data }) => {
        if (data) setClients(data)
        setLoading(false)
      })
  }, [userId])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  const handleSelect = (client) => {
    onSelect({
      client_id: client.id,
      client_name: client.name,
      client_email: client.email,
      client_address: client.address || "",
    })
    setOpen(false)
    setSearch("")
  }

  return (
    <div ref={ref} className={s.wrap}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={s.trigger}
      >
        {currentEmail ? `Change client` : `Pick a saved client`}
      </button>

      {open && (
        <div className={s.dropdown}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className={s.search}
            autoFocus
          />
          {loading ? (
            <div className={s.empty}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className={s.empty}>
              {clients.length === 0 ? "No saved clients yet" : "No matches"}
            </div>
          ) : (
            <div className={s.list}>
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={s.item}
                  data-active={c.email === currentEmail ? "true" : undefined}
                >
                  <div className={s.itemName}>{c.name}</div>
                  <div className={s.itemEmail}>{c.email}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
