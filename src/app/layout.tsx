import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cethos CAT — Translation, evolved",
  description: "Translation memory, terminology, MT, and QA in one editor.",
  icons: {
    icon: [
      { url: "/cethos-favicon.png", type: "image/png" },
    ],
    apple: "/cethos-favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
