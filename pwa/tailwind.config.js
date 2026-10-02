/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b1220",
          raised: "#111a2e",
          sunk: "#070c17",
        },
        line: "#1f2a44",
        ink: {
          DEFAULT: "#e5edff",
          dim: "#8ea0c7",
          mute: "#5a6b8e",
        },
        accent: {
          DEFAULT: "#4f9cff",
          strong: "#7eb6ff",
        },
        signal: {
          excellent: "#22c55e",
          good: "#84cc16",
          fair: "#eab308",
          poor: "#f97316",
          bad: "#ef4444",
          unknown: "#6b7280",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
