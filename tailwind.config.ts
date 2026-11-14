import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        studio: {
          sidebar: "#1e1e24",
          toolbar: "#2b2b36",
          canvas: "#121216",
          panel: "#22222b",
          accent: "#3b82f6",
          "accent-hover": "#2563eb",
          border: "#333342",
          text: "#f3f4f6",
          "text-muted": "#9ca3af",
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out both",
        "slide-up": "slideUp 0.5s ease-out both",
        "scale-in": "scaleIn 0.3s ease-out both",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [],
};

export default config;
