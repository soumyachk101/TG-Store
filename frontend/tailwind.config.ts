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
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.23, 1, 0.32, 1)",
        "in-out-expo": "cubic-bezier(0.77, 0, 0.175, 1)",
        "drawer": "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      animation: {
        "fade-in-up": "fade-in-up 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards",
        "float": "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 3s infinite",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
