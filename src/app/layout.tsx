import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import Header from "@/components/Header";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap" 
});

export const metadata: Metadata = {
  title: "D-MO · Data Micro Optimizer",
  description: "Motor de transformación local de reportes financieros Excel/CSV",
  icons: {
    icon: "/favicon.ico", 
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen bg-slate-50 dark:bg-slate-950`}>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}