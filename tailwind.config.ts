import type { Config } from "tailwindcss";

/**
 * Voygo design system — "Seamless Velocity".
 * Tokens sourced from voygo_design_system/DESIGN.md (Stitch export).
 * Premium Minimalist + Glassmorphism: emerald primary, Inter, large radii.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#f8f9fa",
          dim: "#d9dadb",
          bright: "#f8f9fa",
          variant: "#e1e3e4",
        },
        "surface-container": {
          lowest: "#ffffff",
          low: "#f3f4f5",
          DEFAULT: "#edeeef",
          high: "#e7e8e9",
          highest: "#e1e3e4",
        },
        "on-surface": { DEFAULT: "#191c1d", variant: "#3c4a3c" },
        "inverse-surface": "#2e3132",
        "inverse-on-surface": "#f0f1f2",
        outline: { DEFAULT: "#6c7b6a", variant: "#bbcbb8" },
        primary: {
          DEFAULT: "#006e2a",
          container: "#00c853",
          fixed: "#69ff87",
          "fixed-dim": "#3ce36a",
        },
        "on-primary": { DEFAULT: "#ffffff", container: "#004c1b" },
        "inverse-primary": "#3ce36a",
        secondary: {
          DEFAULT: "#5f5e5e",
          container: "#e5e2e1",
          fixed: "#e5e2e1",
          "fixed-dim": "#c8c6c5",
        },
        "on-secondary": { DEFAULT: "#ffffff", container: "#656464" },
        tertiary: { DEFAULT: "#9d4139", container: "#ff8d81" },
        "on-tertiary": { DEFAULT: "#ffffff", container: "#76251f" },
        error: { DEFAULT: "#ba1a1a", container: "#ffdad6" },
        "on-error": { DEFAULT: "#ffffff", container: "#93000a" },
        background: "#f8f9fa",
        "on-background": "#191c1d",
        // Dark-mode charcoal per DESIGN.md
        charcoal: "#121212",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile": ["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.03em", fontWeight: "500" }],
      },
      borderRadius: {
        sheet: "20px",
        card: "32px",
      },
      spacing: {
        "container-padding": "20px",
        gutter: "16px",
      },
      boxShadow: {
        glass: "0 20px 50px rgba(0,0,0,0.1)",
        "glass-top": "0 -4px 30px rgba(0,0,0,0.05)",
        glow: "0 4px 12px rgba(0,200,83,0.3)",
        lift: "0 1px 2px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.05)",
      },
      backdropBlur: { glass: "24px" },
      keyframes: {
        "pulse-glow": {
          "0%": { boxShadow: "0 0 0 0 rgba(0,200,83,0.4)" },
          "70%": { boxShadow: "0 0 0 15px rgba(0,200,83,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(0,200,83,0)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
