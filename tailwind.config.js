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
        // NOTE: keep the full numeric scale here. Defining `amber` as a bare
        // string wipes out Tailwind's default amber palette, which silently
        // kills classes like `from-amber-600` / `shadow-amber-900`.
        amber: {
          DEFAULT: "#d97706",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
          950: "#451a03",
        },
        "amber-soft": "#fffbeb",
        "amber-deep": "#92400e",
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"] },
    },
  },
  plugins: [],
};
