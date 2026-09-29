import type { Metadata } from "next";
import { ReportProvider } from "@/components/report-provider";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Notion Lab Reports — Reports, ready to submit",
  description:
    "Turn a published Notion page into a polished lab report with a dedicated cover page.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ReportProvider>{children}</ReportProvider>
      </body>
    </html>
  );
}
