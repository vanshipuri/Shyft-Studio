/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { 950: "#0f172a", 900: "#1e293b", 800: "#334155", 700: "#475569", 600: "#64748b", 500: "#94a3b8", 400: "#cbd5e1", 300: "#e2e8f0", 200: "#f1f5f9", 100: "#f8fafc", 50: "#ffffff" },
        ink: { 950: "#030712", 900: "#0a0f1a", 800: "#111827", 700: "#1f2937", 600: "#374151" },
        surface: "#f8fafc",
        "surface-raised": "#ffffff",
        "surface-subtle": "#f1f5f9",
        accent: "#d97706",
        "accent-soft": "#fef3c7",
        "accent-deep": "#92400e",
        rose: "#e11d48",
        "rose-soft": "#fff1f2",
        emerald: "#059669",
        "emerald-soft": "#ecfdf5",
        amber: "#d97706",
        "amber-soft": "#fffbeb",
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] },
    },
  },
  plugins: [],
};
