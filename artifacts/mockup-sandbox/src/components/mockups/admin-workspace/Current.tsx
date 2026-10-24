import { useState } from "react";
import {
  Activity, Banknote, FileClock, Landmark, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Settings2, Shield, Users, WalletCards, X,
} from "lucide-react";

const nav = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/users", label: "User Management", icon: Users },
  { path: "/admin/accounts", label: "Account Management", icon: WalletCards },
  { path: "/admin/transactions", label: "Transaction Management", icon: Activity },
  { path: "/admin/funding", label: "User Funding", icon: Banknote },
  { path: "/admin/wallets", label: "Wallet Controls", icon: LockKeyhole },
  { path: "/admin/restrictions", label: "Restrictions", icon: Shield },
  { path: "/admin/audit", label: "Audit Logs", icon: FileClock },
  { path: "/admin/settings", label: "Settings", icon: Settings2 },
  { path: "/admin/logout", label: "Logout", icon: LogOut },
];

const box = "rounded-[18px] border border-[#dce5e8] bg-[#fffefa] shadow-[0_4px_16px_rgba(28,53,69,.035)]";

// Extracted from the production WorkspaceFrame navigation and header.
// Provider hooks and route links are local preview stubs.
export default function Current() {
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState("/admin/users");
  return (
    <div className="min-h-screen bg-[#f1f5f0] text-[#243d4b]">
      <aside className={`fixed inset-y-0 left-0 z-20 flex w-[250px] flex-col bg-[#17394a] text-[#e4eeee] transition-transform duration-200 lg:translate-x-0 ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#d7bd75] text-[#193b4b]"><Landmark size={19} /></div>
          <div><p className="text-[16px] font-extrabold tracking-[-.05em]">GLOBUS</p><p className="text-[8px] font-bold tracking-[.24em] text-[#d8be77]">OPERATIONS</p></div>
          <button aria-label="Close navigation" onClick={() => setMobile(false)} className="ml-auto lg:hidden"><X size={17} /></button>
        </div>
        <div className="mx-4 my-4 rounded-xl border border-white/10 bg-white/[.06] px-3 py-3">
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.14em] text-[#9ad0c8]"><span className="h-1.5 w-1.5 rounded-full bg-[#80c6b9]" />Globus records</p>
          <p className="mt-1 text-[10px] text-[#a9bec2]">Administrative controls</p>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-4">
          {nav.map(({ path, label, icon: Icon }) => (
            <a key={path} href={path} onClick={event => { event.preventDefault(); setActive(path); setMobile(false); }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition ${active === path ? "bg-[#d7bd75] text-[#203d4b]" : "text-[#d0dfdf] hover:bg-white/[.08]"}`}>
              <Icon size={16} strokeWidth={1.8} />{label}
            </a>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[.055] p-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7e9e5] text-[11px] font-bold text-[#1c4452]">A</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">Operations administrator</p><p className="truncate text-[9px] text-[#a6bec0]">admin@globus.example</p></div>
            <button aria-label="Sign out" className="rounded-lg p-2 text-[#b4c8c9] hover:bg-white/10"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      {mobile && <button aria-label="Dismiss navigation" onClick={() => setMobile(false)} className="fixed inset-0 z-10 bg-[#142a35]/50 lg:hidden" />}
      <div className="min-w-0 lg:pl-[250px]">
        <header className="z-10 flex min-h-[64px] items-center justify-between border-b border-[#dde6e3] bg-[#f7f8f3]/95 px-4 pb-2 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobile(true)} aria-label="Open navigation" className="rounded-lg p-2 hover:bg-[#e5ede8] lg:hidden"><Menu size={17} /></button>
            <p className="truncate text-[11px] text-[#74878a]"><span className="hidden sm:inline">Globus Bank / </span><span className="font-bold text-[#2b4654]">Member directory</span></p>
          </div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-[#e9f4ed] px-2.5 py-1 text-[9px] font-bold text-[#42735b]">Authorized workspace</span><div className="hidden h-8 w-8 place-items-center rounded-full border border-[#d9e3df] bg-white text-[10px] font-bold sm:grid">A</div></div>
        </header>
        <main className="mx-auto w-full max-w-[1450px] px-4 py-5 sm:px-7 sm:py-7 xl:px-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#4f8888]">Member management</p><h1 className="mt-1 text-[32px] font-extrabold tracking-[-.055em] text-[#203b4c]">Member directory</h1><p className="mt-1 text-[12px] text-[#71858b]">Search members and open one record to manage their account.</p></div>
            <button className="rounded-[9px] bg-[#173b50] px-4 py-2.5 text-[11px] font-bold text-white">Add funding</button>
          </div>
          <section className={`${box} overflow-hidden`}>
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e8eeeb] px-5 py-4 sm:px-6"><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#468383]">Customer records</p><h2 className="mt-1 text-[15px] font-bold text-[#263e4b]">All members</h2></div><input className="h-10 w-full max-w-[300px] rounded-[9px] border border-[#d8e1e3] bg-[#fffefa] px-3 text-[12px]" placeholder="Search name, email or Customer ID" /></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-[11px]">
                <thead className="bg-[#f8f9f4] text-[9px] uppercase tracking-[.13em] text-[#8291a0]"><tr><th className="px-6 py-3">Member</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Wallets</th><th className="px-6 py-3 text-right">Actions</th></tr></thead>
                <tbody><tr className="border-t border-[#edf0ed] text-[#445a71]"><td className="px-6 py-4"><b className="block text-[#2d435c]">Avery Morgan</b><span className="mt-1 block text-[10px] text-[#8a97a5]">avery@example.com</span><span className="mt-1 block font-mono text-[10px]">Customer ID: GL8X2FQ</span></td><td className="px-4 py-4">Pending review</td><td className="px-4 py-4">Active</td><td className="px-4 py-4">3</td><td className="px-6 py-4 text-right"><button className="rounded-lg border border-[#dfe6eb] px-3 py-2 text-[10px] font-bold text-[#3f5c75]">Manage member</button></td></tr></tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
