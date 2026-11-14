import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Studio — Professional Client-Side PDF Editor & Tools",
  description:
    "High-accuracy, 100% browser-based PDF editing, conversion, and formatting preservation. Merge, split, compress, convert — all free, all private.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563EB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-800 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
