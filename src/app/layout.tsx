import type { Metadata } from "next";
import { Cantarell, Geist_Mono } from "next/font/google";
import "./globals.css";

const cantarell = Cantarell({
  variable: "--font-sans",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NumTrace — Real Caller ID Lookup",
  description:
    "Look up any US phone number. Real registered caller name (CNAM), carrier, line type, and spam risk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${cantarell.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black">
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
