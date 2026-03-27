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
    successAction: { background: "transparent", color: c.gn, border: `2px solid ${c.gn}` },
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
export const Inp = ({ label, value, onChange, onBlur, ph, type = "text", ta, mono, disabled, error }) => {
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
          onBlur={onBlur}
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
          onBlur={onBlur}
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
      overflow: "hidden",
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 600, color: borderColor === "#d4a017" ? c.go : c.tm, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>
      {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
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
