import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SITE_URL } from "@/lib/site";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: { default: "complete.io: Hinglish sentences, completed for you", template: "%s | complete.io" },
  description:
    "Type half a message in Hinglish and get natural, chat style next words and full sentence completions from a fine tuned GPT-2 model.",
  applicationName: "complete.io",
  robots: { index: true, follow: true },
  openGraph: {
    title: "complete.io",
    description: "Hinglish sentences, completed for you.",
    type: "website",
    siteName: "complete.io",
  },
  twitter: { card: "summary_large_image", title: "complete.io", description: "Hinglish sentences, completed for you." },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff6f7" },
    { media: "(prefers-color-scheme: dark)", color: "#170f13" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
