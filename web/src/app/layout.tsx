import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: { default: "complete.io: Hinglish sentences, completed for you", template: "%s | complete.io" },
  description:
    "Type half a message in Hinglish and get natural, chat style next words and full sentence completions from a fine tuned GPT-2 model.",
  applicationName: "complete.io",
  robots: { index: true, follow: true },
  openGraph: {
    title: "complete.io",
    description: "Hinglish sentences, completed for you.",
    type: "website",
  },
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
