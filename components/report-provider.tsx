"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { defaultSettings, type ReportSettings } from "@/lib/settings";
import type { ReportDocument } from "@/lib/types";

interface ReportState {
  theme: "system" | "light" | "dark";
  setTheme: (theme: "system" | "light" | "dark") => void;
  report: ReportDocument | null;
  setReport: (document: ReportDocument) => void;
  settings: ReportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ReportSettings>>;
}
const ReportContext = createContext<ReportState | null>(null);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [report, saveReport] = useState<ReportDocument | null>(null);
  const [settings, setSettings] = useState<ReportSettings>(defaultSettings);
  const setReport = useCallback((document: ReportDocument) => {
    saveReport(document);
    setSettings({ ...defaultSettings, filename: document.title });
  }, []);
  return (
    <ReportContext.Provider
      value={{ report, setReport, settings, setSettings, theme, setTheme }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);
  if (!context) throw new Error("The report provider is missing.");
  return context;
}
