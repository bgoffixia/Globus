import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

const PROMPT_INTERVAL_MS = 5 * 60 * 60 * 1000;
const PROMPT_SHOWN_KEY = "globus:pwa-prompt-shown-at";
const INSTALLED_KEY = "globus:pwa-installed";
const OPEN_PROMPT_EVENT = "globus:open-install-prompt";
const INSTALLED_EVENT = "globus:pwa-installed";

function isAppInstalled() {
  let wasInstalled = false;
  try {
    wasInstalled = localStorage.getItem(INSTALLED_KEY) === "true";
  } catch {
    // Standalone display mode is sufficient when browser storage is unavailable.
  }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    wasInstalled
  );
}

function markPromptShown() {
  try {
    localStorage.setItem(PROMPT_SHOWN_KEY, String(Date.now()));
  } catch {
    // The install action remains available if storage is disabled.
  }
}

export function PwaInstallPrompt() {
  const [location] = useLocation();
  const installPrompt = useRef<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installError, setInstallError] = useState("");
  const isAuthPage =
    location === "/sign-in" ||
    location.startsWith("/sign-in/") ||
    location === "/sign-up" ||
    location.startsWith("/sign-up/");

  useEffect(() => {
    if (isAppInstalled()) return;

    const platform = navigator.userAgent.toLowerCase();
    setIsIos(
      /iphone|ipad|ipod/.test(platform) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    const openIfEligible = () => {
      if (isAuthPage || isAppInstalled()) return;
      let lastShown = 0;
      try {
        lastShown = Number(localStorage.getItem(PROMPT_SHOWN_KEY) ?? 0);
      } catch {
        lastShown = 0;
      }
      if (Number.isFinite(lastShown) && Date.now() - lastShown < PROMPT_INTERVAL_MS) return;
      markPromptShown();
      setOpen(true);
    };
    const showTimer = window.setTimeout(openIfEligible, 900);
    const handleManualOpen = () => {
      if (isAuthPage || isAppInstalled()) return;
      markPromptShown();
      setInstallError("");
      setOpen(true);
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as InstallPromptEvent;
      setCanInstall(true);
      openIfEligible();
    };
    const handleInstalled = () => {
      installPrompt.current = null;
      setCanInstall(false);
      setOpen(false);
      try {
        localStorage.setItem(INSTALLED_KEY, "true");
      } catch {
        // Standalone mode is still detected when the installed app opens.
      }
      window.dispatchEvent(new Event(INSTALLED_EVENT));
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener(OPEN_PROMPT_EVENT, handleManualOpen);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener(OPEN_PROMPT_EVENT, handleManualOpen);
    };
  }, [isAuthPage]);

  useEffect(() => {
    if (isAuthPage) setOpen(false);
  }, [isAuthPage]);

  const install = async () => {
    setInstallError("");
    const promptEvent = installPrompt.current;
    if (!promptEvent) {
      setInstallError(
        isIos
          ? "On iPhone or iPad, tap Share and choose Add to Home Screen. iOS requires this step to be completed in Safari."
          : "One-click installation is not available in this browser. Open the browser menu and choose Install app or Add to Home Screen.",
      );
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstallError("");
      installPrompt.current = null;
      setCanInstall(false);
      setOpen(false);
    } catch {
      setInstallError("The browser could not open its install prompt. Use the browser menu to install Globus Bank.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) markPromptShown();
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="left-4 right-4 w-auto max-w-[420px] translate-x-0 rounded-[22px] border-[#dfe7ec] bg-white p-6 sm:left-1/2 sm:right-auto sm:w-[calc(100vw-2rem)] sm:translate-x-[-50%] sm:p-7">
        <DialogHeader className="text-left">
          <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#eef5f6] text-[#2b6f79]">
            {isIos ? <Share2 size={19} /> : <Download size={19} />}
          </span>
          <DialogTitle className="text-[18px] text-[#213a55]">
            Install Globus Bank
          </DialogTitle>
          <DialogDescription className="text-[12px] leading-5 text-[#718296]">
            Add Globus to your device for a direct app shortcut and a dedicated
            full-screen experience.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-[#dce8e9] bg-[#f2f8f8] px-4 py-3 text-[11px] leading-5 text-[#4f777a]">
          {isIos ? (
            <span>
              In Safari, tap <b>Share</b>, then choose <b>Add to Home Screen</b>.
            </span>
          ) : canInstall ? (
            <span>Choose Install to add the app to this device.</span>
          ) : (
            <span>
              Open your browser menu and choose <b>Install app</b> or{" "}
              <b>Add to Home Screen</b>.
            </span>
          )}
        </div>
        {installError && (
          <p role="alert" className="mt-3 text-[11px] text-[#a24940]">
            {installError}
          </p>
        )}
        <DialogFooter className="mt-1 gap-2 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              markPromptShown();
              setOpen(false);
            }}
            className="h-10 rounded-xl border border-[#dfe6eb] px-4 text-[11px] font-bold text-[#546b80] hover:bg-[#f5f8f9]"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={install}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173b62] px-4 text-[11px] font-bold text-white hover:bg-[#214c76]"
          >
            <Download size={14} />
            Install app
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [installed, setInstalled] = useState(() => isAppInstalled());

  useEffect(() => {
    const syncInstalled = () => setInstalled(isAppInstalled());
    window.addEventListener(INSTALLED_EVENT, syncInstalled);
    window.addEventListener("appinstalled", syncInstalled);
    const displayMode = window.matchMedia("(display-mode: standalone)");
    displayMode.addEventListener?.("change", syncInstalled);
    return () => {
      window.removeEventListener(INSTALLED_EVENT, syncInstalled);
      window.removeEventListener("appinstalled", syncInstalled);
      displayMode.removeEventListener?.("change", syncInstalled);
    };
  }, []);

  if (installed) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PROMPT_EVENT))}
      className={className}
    >
      <Download size={15} aria-hidden="true" />
      Install app
    </button>
  );
}
