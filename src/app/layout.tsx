import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://builtbyskills.com"),
  title: "Builtbyskills | Learn Digital Skills & Start Earning",
  description:
    "Learn Meta Ads, Shopify, Amazon, eBay and Graphic Designing through practical live classes, mentorship and Fiverr guidance with Builtbyskills.",
  openGraph: {
    title: "Builtbyskills | Learn Digital Skills & Start Earning",
    description:
      "Practical live classes, mentorship, and Fiverr guidance for modern digital skills.",
    siteName: "Builtbyskills",
    images: [
      {
        url: "/img/builtbyskills-hero.png",
        width: 1200,
        height: 900,
        alt: "Builtbyskills digital skills dashboard visual",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#080808]">{children}</body>
    </html>
  );
}
