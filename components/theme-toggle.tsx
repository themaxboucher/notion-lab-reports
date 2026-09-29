"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useReport } from "./report-provider";

export function ThemeToggle() {
  const { theme: mode, setTheme: setMode } = useReport();
  function toggle() {
    const next =
      mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    setMode(next);
    document.documentElement.dataset.theme = next;
  }
  const Icon = mode === "system" ? Monitor : mode === "light" ? Sun : Moon;
  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggle}
      title={`Theme: ${mode}. Click to change.`}
      aria-label={`Theme: ${mode}. Switch to ${mode === "system" ? "light" : mode === "light" ? "dark" : "system"} mode`}
    >
      <Icon size={17} />
    </button>
  );
}
