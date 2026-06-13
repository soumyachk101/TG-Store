import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Subtle, single-developer-tool palette
        bg: {
          DEFAULT: "#0b0d10",
          subtle: "#12151a",
          raised: "#181c22",
        },
        line: {
          DEFAULT: "#1f242c",
          strong: "#2a313b",
        },
        ink: {
          DEFAULT: "#e7ecf2",
          muted: "#9aa4b2",
          faint: "#6b7280",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
        danger: "#ef4444",
        success: "#22c55e",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
