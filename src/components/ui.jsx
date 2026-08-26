import { useState, useEffect, useCallback, useContext, createContext } from "react"
import { Check, AlertTriangle, Info } from "lucide-react"
import s from "./ui.module.css"

// ── ConfirmDialog ──
// Drop-in replacement for window.confirm — but branded, mobile-friendly,
// and async-safe. The promise-based API mirrors window.confirm so
// existing call sites can be replaced with a one-line swap:
//   if (!window.confirm("X?")) return  →  if (!(await confirm({ title: "X?" }))) return
function ConfirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger, onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onCancel()
      // Enter only confirms if it's not in a textarea/input (user might be typing)
      if (e.key === "Enter" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener("keydown", handler)
    // Lock body scroll while modal open
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = original
    }
  }, [onConfirm, onCancel])

  return (
    <div className={s.confirmOverlay} onClick={onCancel} role="presentation">
      <div
        className={s.confirmBox}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hielda-confirm-title"
      >
        <h3 className={s.confirmTitle} id="hielda-confirm-title">{title}</h3>
        {message && <p className={s.confirmMessage}>{message}</p>}
        <div className={s.confirmActions}>
          <button onClick={onCancel} className={s.confirmCancelBtn} type="button">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={danger ? s.confirmDangerBtn : s.confirmActionBtn}
            type="button"
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      // Accept a string for ergonomics — confirm("Are you sure?") works.
      const normalised = typeof opts === "string" ? { title: opts } : (opts || {})
      setState({ ...normalised, resolve })
    })
  }, [])

  const handleConfirm = () => {
    state?.resolve(true)
    setState(null)
  }
  const handleCancel = () => {
    state?.resolve(false)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          title={state.title}
          message={state.message}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          danger={state.danger}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const fn = useContext(ConfirmContext)
  if (!fn) {
    // Graceful fallback if used outside provider — fall back to native
    // confirm rather than throwing. Easier to debug than a crash.
    return (opts) => Promise.resolve(window.confirm(typeof opts === "string" ? opts : (opts?.title || "Confirm?") + (opts?.message ? "\n\n" + opts.message : "")))
  }
  return fn
}

// ── Toast / Snackbar ──
// Lightweight notification system. Replaces ad-hoc "setTimeout(() =>
// setSendSuccess(''), 5000)" patterns sprinkled through components.
// API mirrors common toast libraries:
//   const toast = useToast()
//   toast.success("Invoice email sent")
//   toast.error("Failed to send: " + e.message)
//   toast.info("Refreshing...")
// Toasts stack, auto-dismiss after their duration, can be dismissed
// manually via the × on each.
function ToastItem({ id, message, variant, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${s.toast} ${variant === "error" ? s.toastError : variant === "success" ? s.toastSuccess : s.toastInfo}`}
    >
      <span className={s.toastIcon} aria-hidden="true">
        {variant === "error" ? <AlertTriangle size={15} /> : variant === "success" ? <Check size={15} strokeWidth={2.5} /> : <Info size={15} />}
      </span>
      <span className={s.toastMessage}>{message}</span>
      <button onClick={() => onDismiss(id)} className={s.toastDismiss} aria-label="Dismiss notification">×</button>
    </div>
  )
}

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message, variant = "info", duration = 4500) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((cur) => [...cur, { id, message, variant }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const api = {
    show,
    success: (msg, dur) => show(msg, "success", dur),
    error: (msg, dur) => show(msg, "error", dur ?? 6000),
    info: (msg, dur) => show(msg, "info", dur),
    dismiss,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div className={s.toastStack} aria-live="polite">
          {toasts.map((t) => (
            <ToastItem key={t.id} {...t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) {
    // No-op fallback so call sites don't crash if used outside provider
    return { show: () => {}, success: () => {}, error: () => {}, info: () => {}, dismiss: () => {} }
  }
  return api
}

// ── Skeleton ──
// Subtle shimmering placeholder for content that's loading. Use for
// async data that takes >300ms to arrive — instant or near-instant
// loads don't benefit and feel laggy if you flash a skeleton.
// Examples: chase log entries, notification rows, dashboard rows.
export function Skeleton({ width, height = 14, radius = 6, style: userStyle, className }) {
  return (
    <div
      aria-hidden="true"
      className={`${s.skeleton} ${className || ""}`}
      style={{ width: width ?? "100%", height, borderRadius: radius, ...userStyle }}
    />
  )
}


// ── Badge ──
export const Badge = ({ children, color = "var(--ac)" }) => (
  <span
    role="status"
    className={s.badge}
    style={{
      color,
      background: `${color}12`,
      border: `1px solid ${color}20`,
    }}
  >
    {children}
  </span>
)

// ── Button ──
export const Btn = ({ children, onClick, v = "primary", sz = "md", dis, style: userStyle, type = "button" }) => (
  <button
    type={type}
    onClick={dis ? undefined : onClick}
    disabled={dis}
    className={s.btn}
    data-variant={v}
    data-size={sz}
    data-disabled={dis ? "true" : undefined}
    style={userStyle}
  >
    {children}
  </button>
)

// ── Card ──
export const Card = ({ children, style, onClick, as: Tag = "div" }) => (
  <Tag
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
    className={s.card}
    data-clickable={onClick ? "true" : undefined}
    style={style}
  >
    {children}
  </Tag>
)

// ── Input ──
export const Inp = ({ label, value, onChange, onBlur, ph, type = "text", ta, mono, disabled, error, inputMode, autoComplete, autoCapitalize, enterKeyHint, spellCheck, rows }) => (
  <div className={s.inpWrap}>
    {label && (
      <label className={s.inpLabel}>
        {label}
      </label>
    )}
    {ta ? (
      <textarea
        rows={rows ?? 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={ph}
        className={s.inpTextarea}
        data-error={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-mono={mono ? "true" : undefined}
        disabled={disabled}
        aria-label={label}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        enterKeyHint={enterKeyHint}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={ph}
        className={s.inpField}
        data-error={error ? "true" : undefined}
        data-disabled={disabled ? "true" : undefined}
        data-mono={mono ? "true" : undefined}
        disabled={disabled}
        aria-label={label}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        enterKeyHint={enterKeyHint}
      />
    )}
    {error && <div className={s.inpError}>{error}</div>}
  </div>
)

// ── Select ──
export const Sel = ({ label, value, onChange, opts }) => (
  <div className={s.selWrap}>
    {label && (
      <label className={s.inpLabel}>
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className={s.selField}
    >
      {opts.map((o) => (
        <option key={o.v} value={o.v}>{o.l}</option>
      ))}
    </select>
  </div>
)

// ── Stat Card ──
export const StatCard = ({ label, value, sub, color, borderColor }) => (
  <div
    className={s.statCard}
    style={{
      borderLeft: `3px solid ${borderColor}`,
      // A whisper of the accent colour washing in from the accent edge —
      // enough to make each card feel owned by its number, not painted.
      background: `linear-gradient(105deg, ${borderColor}0d, var(--sf) 45%)`,
    }}
  >
    <div className={s.statLabel} data-gold={borderColor === "#d4a017" ? "true" : undefined}>
      {label}
    </div>
    <div className={s.statValue} style={{ color }}>{value}</div>
    {sub && <div className={s.statSub}>{sub}</div>}
  </div>
)

// ── Shield Logo ──
export const ShieldLogo = ({ size = 18, white }) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 80 96" aria-hidden="true">
    <path
      d="M40 4 L72 16 L72 52 Q72 78 40 92 Q8 78 8 52 L8 16 Z"
      fill={white ? "rgba(255,255,255,0.18)" : "#1e5fa0"}
      stroke={white ? "#fff" : "none"}
      strokeWidth={white ? "2" : "0"}
    />
    <rect x="24" y="26" width="8" height="40" rx="2" fill="#fff" />
    <rect x="48" y="26" width="8" height="40" rx="2" fill="#fff" />
    <rect x="30" y="42" width="20" height="8" rx="2" fill="#fff" />
  </svg>
)

// ── Error Banner ──
export const ErrorBanner = ({ message, onDismiss }) => {
  if (!message) return null
  return (
    <div role="alert" className={s.errorBanner}>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className={s.errorDismiss} aria-label="Dismiss error">
          ×
        </button>
      )}
    </div>
  )
}

// ── Info Banner ──
export const InfoBanner = ({ message }) => {
  if (!message) return null
  return (
    <div role="status" className={s.infoBanner}>
      {message}
    </div>
  )
}

// ── Sidebar Decoration (matches ShieldLogo + knotwork border) ──
export const SidebarDecoration = () => (
  <svg width="160" height="192" viewBox="0 0 160 192" aria-hidden="true" style={{ opacity: 0.12 }}>
    {/* Outer shield border */}
    <path
      d="M80 6 L148 30 L148 108 Q148 160 80 188 Q12 160 12 108 L12 30 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
    />
    {/* Knotwork band — interlacing arcs between outer and inner shield */}
    {/* Top row */}
    <path d="M44 22 Q56 14 68 22 Q80 14 92 22 Q104 14 116 22" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M44 28 Q56 36 68 28 Q80 36 92 28 Q104 36 116 28" fill="none" stroke="#fff" strokeWidth="1.5" />
    {/* Right side */}
    <path d="M138 40 Q146 52 138 64 Q146 76 138 88 Q146 100 138 112" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M132 40 Q124 52 132 64 Q124 76 132 88 Q124 100 132 112" fill="none" stroke="#fff" strokeWidth="1.5" />
    {/* Left side */}
    <path d="M22 40 Q14 52 22 64 Q14 76 22 88 Q14 100 22 112" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M28 40 Q36 52 28 64 Q36 76 28 88 Q36 100 28 112" fill="none" stroke="#fff" strokeWidth="1.5" />
    {/* Bottom curves */}
    <path d="M32 118 Q44 126 56 118 Q68 126 80 118 Q92 126 104 118 Q116 126 128 118" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M36 124 Q48 116 60 124 Q72 116 80 124 Q88 116 100 124 Q112 116 124 124" fill="none" stroke="#fff" strokeWidth="1.5" />
    {/* Bottom point knotwork */}
    <path d="M56 138 Q68 146 80 138 Q92 146 104 138" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M60 144 Q72 136 80 144 Q88 136 100 144" fill="none" stroke="#fff" strokeWidth="1.5" />
    <path d="M68 156 Q74 162 80 156 Q86 162 92 156" fill="none" stroke="#fff" strokeWidth="1.5" />
    {/* Inner shield — same shape as ShieldLogo */}
    <path
      d="M80 32 L136 48 L136 104 Q136 148 80 172 Q24 148 24 104 L24 48 Z"
      fill="rgba(255,255,255,0.05)"
      stroke="#fff"
      strokeWidth="2"
    />
    {/* H letter — same proportions as ShieldLogo */}
    <rect x="52" y="60" width="14" height="72" rx="3" fill="#fff" />
    <rect x="94" y="60" width="14" height="72" rx="3" fill="#fff" />
    <rect x="62" y="88" width="36" height="14" rx="3" fill="#fff" />
  </svg>
)

// ── Loading Spinner ──
export const Spinner = ({ size = 20, color = "var(--ac)" }) => (
  <div
    role="status"
    aria-label="Loading"
    className={s.spinner}
    style={{
      width: size,
      height: size,
      border: `2px solid ${color}30`,
      borderTopColor: color,
    }}
  />
)

// ── Collapsible Section (accordion) ──
export function CollapsibleSection({ title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={s.collapsible}>
      <button onClick={() => setOpen(!open)} className={s.collapsibleToggle}>
        <div>
          <h3 className={s.collapsibleTitle}>{title}</h3>
          {description && <p className={s.collapsibleDesc}>{description}</p>}
        </div>
        <span className={s.collapsibleArrow} data-open={open ? "true" : undefined}>▼</span>
      </button>
      {open && <div className={s.collapsibleBody}>{children}</div>}
    </div>
  )
}
