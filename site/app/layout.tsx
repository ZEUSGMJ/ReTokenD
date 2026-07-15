import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { SITE_URL } from "./components/landing/content";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const description =
  "A self-hosted service that keeps Spotify refresh tokens in one place, issues short-lived access tokens, and handles six-month re-authorization.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "ReTokenD: self-hosted Spotify token manager",
  description,
  openGraph: {
    title: "ReTokenD",
    description,
    type: "website",
    siteName: "ReTokenD",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full font-sans">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
