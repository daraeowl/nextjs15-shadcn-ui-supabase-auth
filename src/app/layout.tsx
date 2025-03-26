import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SupabaseProvider } from "@/lib/supabase/provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { SidebarContent, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Analytics } from "@vercel/analytics/react"
import { AchievementNotificationManager } from "@/components/achievement-notification-manager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Supabase Auth Example",
  description: "A simple example of how to use Supabase Auth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Analytics */}
        <Analytics />
        <SupabaseProvider>
          <SidebarProvider>
            <TooltipProvider>
              <ErrorBoundary>
                <AppSidebar />
                <SidebarTrigger />

                <div className="w-full max-w-4xl mx-auto mb-8 sm:max-w-6xl sm:mx-auto md:max-w-8xl md:mx-auto lg:max-w-10xl lg:mx-auto">
                  <div className="flex flex-col h-full">
                    <SidebarContent>
                      <main className="flex-1">
                        {children}
                      </main>
                    </SidebarContent>
                  </div>
                </div>
              </ErrorBoundary>
            </TooltipProvider>
          </SidebarProvider>
          {/* Achievement notifications */}
          <AchievementNotificationManager />
          <Toaster position="top-center" closeButton richColors />
        </SupabaseProvider>
      </body>
    </html >
  );
}
