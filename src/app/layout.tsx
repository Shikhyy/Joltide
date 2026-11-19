import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { IdentityProvider } from "@/components/IdentityProvider";
import Nav from "@/components/Nav";
import SmoothScroll from "@/components/SmoothScroll";
import Toaster from "@/components/Toaster";

const head = Bricolage_Grotesque({ variable: "--font-head", subsets: ["latin"], axes: ["opsz", "wdth"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JOLTIDE: turn moments into movements",
  description:
    "Design, host and measure interactive experiences for your community. AI-built worlds, real-time collaboration powered by Nexconn, shared progression.",
};
export const viewport: Viewport = { themeColor: "#0a090b", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${head.variable} ${body.variable} ${mono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <SmoothScroll />
        <Toaster />
        <IdentityProvider>
          <Nav />
          <main className="flex-1">{children}</main>
        </IdentityProvider>
      </body>
    </html>
  );
}
