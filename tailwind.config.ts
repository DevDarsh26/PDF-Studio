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
    },
  },
  plugins: [],
};

export default config;

