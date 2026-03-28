import type { Metadata } from "next";
import { ThemeProvider } from "@/components/blocks/theme/theme-provider";
import { inter, geistMono } from "@/lib/fonts";

import "./globals.css";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/navbar";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Vercel Tools",
  description: "Management tools for Vercel projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <Navbar />
          <div className="flex-1">{children}</div>
          <Toaster />
          </ThemeProvider>
      </body>
    </html>
  );
}
