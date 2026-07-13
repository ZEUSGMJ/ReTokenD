import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const description =
  "A small self-hosted service that keeps Spotify refresh tokens in one place, hands short-lived access tokens to other projects, and makes the 6-month re-authorization a single click.";

export const metadata: Metadata = {
  title: "ReTokenD: self-hosted Spotify token manager",
  description,
  openGraph: {
    title: "ReTokenD",
    description,
    type: "website",
    siteName: "ReTokenD",
  },
  twitter: {
    card: "summary",
    title: "ReTokenD",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
