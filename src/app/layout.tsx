import type { Metadata, Viewport } from "next";
import {
  DM_Sans,
  DM_Serif_Display,
  EB_Garamond,
  Inter,
  JetBrains_Mono,
  Nunito,
  Orbitron,
  Playfair_Display,
  Source_Serif_4,
  Space_Grotesk,
  Space_Mono,
} from "next/font/google";
import "./globals.css";
import { ThemeProviderRoot } from "@/components/ThemeProviderRoot";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif-display",
  subsets: ["latin"],
  weight: ["400"],
  preload: false,
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
  preload: false,
});
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  preload: false,
});
const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  preload: false,
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  preload: false,
});
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  preload: false,
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  preload: false,
});
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  preload: false,
});
const ebGaramond = EB_Garamond({
  variable: "--font-eb-garamond",
  subsets: ["latin"],
  preload: false,
});

const storefrontFonts = [
  playfairDisplay.variable,
  jetBrainsMono.variable,
  orbitron.variable,
  sourceSerif.variable,
  nunito.variable,
  spaceMono.variable,
  spaceGrotesk.variable,
  inter.variable,
  ebGaramond.variable,
].join(" ");

export const metadata: Metadata = {
  metadataBase: new URL("https://roastd.id"),
  title: {
    default: "roastd.id — Roastery Operating System",
    template: "%s | roastd.id",
  },
  description:
    "Sistem operasional untuk menghubungkan pembelian, inventory, roasting, produksi, penjualan, dan keuangan coffee roastery.",
  applicationName: "roastd.id",
  appleWebApp: {
    capable: true,
    title: "roastd.id",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon",
    apple: "/icon",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${dmSans.variable} ${dmSerifDisplay.variable} ${jetBrainsMono.variable} ${storefrontFonts} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full" suppressHydrationWarning>
        <ThemeProviderRoot>{children}</ThemeProviderRoot>
      </body>
    </html>
  );
}
