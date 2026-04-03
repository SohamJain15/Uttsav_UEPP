/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        govBlue: "#1E40AF",
        lightBg: "#F8FAFC",
        cardBg: "#FFFFFF",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        success: "#16A34A",
        warning: "#F59E0B",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["Source Sans 3", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.06)",
      },
      maxWidth: {
        content: "1400px",
      },
    },
  },
  plugins: [],
};
