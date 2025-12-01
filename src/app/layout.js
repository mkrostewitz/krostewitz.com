import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mathias Krostewitz — Operator & Builder",
  description:
    "Lean operator and full-stack builder with leadership across Asia and the US.",
  icons: {
    icon: [{url: "/mk-favicon.svg", type: "image/svg+xml"}],
  },
};

export default function RootLayout({children}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
