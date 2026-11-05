/** Shared visual decisions from the UI UX Pro Max design review. */
export const designTokens = {
  colors: {
    primary: "#2563eb",
    primaryHover: "#1d4ed8",
    primarySoft: "#eff6ff",
    primaryBorder: "#bfdbfe",
    onPrimary: "#ffffff",
    ink: "#1e293b",
    muted: "#475569",
    subtle: "#64748b",
    canvas: "#f8fafc",
    surface: "#ffffff",
    surfaceSoft: "#f1f5f9",
    border: "#e2e8f0",
    controlBorder: "#cbd5e1",
    success: "#15803d",
    warning: "#a16207",
    danger: "#dc2626",
    disabled: "#edf1f5",
    disabledText: "#6b7789",
  },
  fontFamily:
    '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", sans-serif',
  radius: { control: "12px", card: "20px", composer: "24px", pill: "999px" },
  shadow: {
    card: "0 2px 8px rgba(30,41,59,.025)",
    hover: "0 8px 24px rgba(37,99,235,.08)",
    composer: "0 8px 32px rgba(37,99,235,.055)",
    overlay: "0 12px 36px rgba(30,41,59,.12)",
  },
  focus: { outline: "2px solid #2563eb", outlineOffset: 3 },
  transition:
    "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
} as const;
