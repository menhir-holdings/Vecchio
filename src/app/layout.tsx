import type { Metadata, Viewport } from "next";
import { Courier_Prime, EB_Garamond, Figtree } from "next/font/google";
import "./globals.css";

const garamond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  display: "swap",
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const courier = Courier_Prime({
  variable: "--font-courier-prime",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vecchio — shared page",
  description:
    "A shared page across your devices. Anyone with the four-character code can write — no account.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  themeColor: "#1a120c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="overscroll-none">
      <body
        className={`${garamond.variable} ${figtree.variable} ${courier.variable} antialiased overscroll-none`}
      >
        {children}
      </body>
    </html>
  );
}
