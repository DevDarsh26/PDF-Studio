import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Studio — Professional Client-Side PDF Editor",
  description: "High-accuracy, 100% browser-based PDF editing and formatting preservation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-studio-canvas text-studio-text overflow-hidden">
        {children}
      </body>
    </html>
  );
}
