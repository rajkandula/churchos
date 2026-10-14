"use client";

import { MonitorDown, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "churchos_install_dismissed";

/** Registers the service worker and offers Chrome's install prompt. */
export function PwaSetup() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* installability is a bonus — never break the app over it */
      });
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      if (localStorage.getItem(DISMISS_KEY)) return;
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installEvent) return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "dismissed") localStorage.setItem(DISMISS_KEY, "1");
    setInstallEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setInstallEvent(null);
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 animate-fade-up print:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl shadow-slate-900/15">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
          <MonitorDown className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Install ChurchOS</p>
          <p className="text-xs text-slate-500">
            Get it as an app — opens full-screen, right from your home screen.
          </p>
        </div>
        <button
          onClick={install}
          className="shrink-0 cursor-pointer rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
