import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        sm: "0 2px 8px rgba(104, 73, 45, 0.04)",
        DEFAULT: "0 3px 12px rgba(104, 73, 45, 0.05)",
        md: "0 5px 18px rgba(104, 73, 45, 0.06)",
        lg: "0 8px 24px rgba(104, 73, 45, 0.07)",
        xl: "0 12px 32px rgba(104, 73, 45, 0.08)",
        "2xl": "0 18px 44px rgba(104, 73, 45, 0.1)",
        glow: "0 16px 48px rgba(166, 113, 61, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
