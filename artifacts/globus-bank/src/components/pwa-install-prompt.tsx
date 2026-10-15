import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
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

export function PwaInstallPrompt() {
  const installPrompt = useRef<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const platform = navigator.userAgent.toLowerCase();
    setIsIos(
      /iphone|ipad|ipod/.test(platform) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );

    // Do not persist dismissal: the offer returns after the next full page load.
    const showTimer = window.setTimeout(() => setOpen(true), 900);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as InstallPromptEvent;
      setCanInstall(true);
      setOpen(true);
    };
    const handleInstalled = () => {
      installPrompt.current = null;
      setCanInstall(false);
      setOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    setInstallError("");
    const promptEvent = installPrompt.current;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      installPrompt.current = null;
      setCanInstall(false);
      setOpen(false);
    } catch {
      setInstallError("The browser could not open its install prompt. Use the browser menu to install Globus Bank.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[420px] rounded-[22px] border-[#dfe7ec] bg-white p-6 sm:p-7">
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
            onClick={() => setOpen(false)}
            className="h-10 rounded-xl border border-[#dfe6eb] px-4 text-[11px] font-bold text-[#546b80] hover:bg-[#f5f8f9]"
          >
            Not now
          </button>
          {canInstall && !isIos && (
            <button
              type="button"
              onClick={install}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#173b62] px-4 text-[11px] font-bold text-white hover:bg-[#214c76]"
            >
              <Download size={14} />
              Install app
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
