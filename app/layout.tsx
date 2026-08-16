import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: "Strux — Design specs for software engineers",
    template: "%s · Strux",
  },
  description:
    "Version-controlled collaborative design document editor. Write specs, review with AI, branch like Git, and ship to Cursor or Claude.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Strux — Design specs for software engineers",
    description:
      "Write design specs collaboratively, review with AI, and export to Cursor, Claude, or any AI coding tool.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem("theme")||"system";var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var isDark=theme==="dark"||(theme==="system"&&prefersDark);document.documentElement.classList.toggle("dark",isDark);document.documentElement.style.colorScheme=isDark?"dark":"light";}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
