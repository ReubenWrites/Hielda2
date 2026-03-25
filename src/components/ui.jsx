import { useState, useCallback } from "react"
import { colors as c, FONT, MONO } from "../constants"

// ── Badge ──
export const Badge = ({ children, color = c.ac }) => (
  <span
    role="status"
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 9px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      color,
      background: `${color}12`,
      border: `1px solid ${color}20`,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
)

// ── Button ──
export const Btn = ({ children, onClick, v = "primary", sz = "md", dis, style: s, type = "button" }) => {
  const [hovered, setHovered] = useState(false)

  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "none",
    borderRadius: 10,
    fontFamily: FONT,
    fontWeight: 600,
    cursor: dis ? "not-allowed" : "pointer",
    transition: "all 0.2s",
    opacity: dis ? 0.5 : 1,
    whiteSpace: "nowrap",
    transform: hovered && !dis ? "translateY(-1px)" : "none",
  }

  const sizes = {
    sm: { padding: "7px 14px", fontSize: 12 },
    md: { padding: "10px 20px", fontSize: 13 },
    lg: { padding: "14px 28px", fontSize: 14 },
  }

  const variants = {
    primary: { background: c.ac, color: c.w },
    ghost: { background: "transparent", color: c.tm, border: `1px solid ${c.bd}` },
    danger: { background: c.ord, color: c.or, border: `1px solid ${c.or}20` },
    success: { background: c.gnd, color: c.gn, border: `1px solid ${c.gn}20` },
  }

  return (
    <button
      type={type}
      onClick={dis ? undefined : onClick}
      disabled={dis}
      style={{ ...base, ...sizes[sz], ...variants[v], ...s }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

// ── Card ──
export const Card = ({ children, style, onClick, as: Tag = "div" }) => {
  const [hovered, setHovered] = useState(false)

  return (
    <Tag
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } } : undefined}
      style={{
        background: hovered && onClick ? c.sfh : c.sf,
        border: `1px solid ${hovered && onClick ? c.acl : c.bd}`,
        borderRadius: 14,
        padding: 24,
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Tag>
  )
}

// ── Input ──
export const Inp = ({ label, value, onChange, ph, type = "text", ta, mono, disabled, error }) => {
  const shared = {
    width: "100%",
    padding: "10px 14px",
    background: disabled ? "#eee" : c.bg,
    border: `1px solid ${error ? c.or : c.bd}`,
    borderRadius: 8,
    color: c.tx,
    fontFamily: mono ? MONO : FONT,
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    opacity: disabled ? 0.6 : 1,
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.tm, marginBottom: 6 }}>
          {label}
        </label>
      )}
      {ta ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ph}
          style={{ ...shared, resize: "vertical" }}
          disabled={disabled}
          aria-label={label}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ph}
          style={shared}
          disabled={disabled}
          aria-label={label}
        />
      )}
      {error && <div style={{ fontSize: 11, color: c.or, marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ── Select ──
export const Sel = ({ label, value, onChange, opts }) => (
  <div style={{ marginBottom: 14 }}>
    {label && (
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: c.tm, marginBottom: 6 }}>
        {label}
      </label>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      style={{
        width: "100%",
        padding: "10px 14px",
        background: c.bg,
        border: `1px solid ${c.bd}`,
        borderRadius: 8,
        color: c.tx,
        fontFamily: FONT,
        fontSize: 13,
        outline: "none",
        cursor: "pointer",
      }}
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
    style={{
      background: c.sf,
      border: `1px solid ${c.bd}`,
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: "0 10px 10px 0",
      padding: "13px 14px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 600, color: borderColor === "#d4a017" ? c.go : c.tm, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 600, color, fontFamily: MONO }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: c.td, marginTop: 3 }}>{sub}</div>}
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
    <div
      role="alert"
      style={{
        padding: "10px 14px",
        background: c.ord,
        color: c.or,
        borderRadius: 8,
        fontSize: 12,
        marginBottom: 14,
        lineHeight: 1.4,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{ background: "none", border: "none", color: c.or, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
          aria-label="Dismiss error"
        >
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
    <div
      role="status"
      style={{
        padding: "10px 14px",
        background: c.acd,
        color: c.ac,
        borderRadius: 8,
        fontSize: 12,
        marginBottom: 14,
        lineHeight: 1.4,
      }}
    >
      {message}
    </div>
  )
}

// ── Loading Spinner ──
export const Spinner = ({ size = 20, color = c.ac }) => (
  <div
    role="status"
    aria-label="Loading"
    style={{
      width: size,
      height: size,
      border: `2px solid ${color}30`,
      borderTopColor: color,
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
      display: "inline-block",
    }}
  />
)
