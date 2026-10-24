import { useMemo, useState, type ReactNode } from "react";
import "./_group.css";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Banknote, Bell, ChevronDown,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, FileClock, Filter,
  LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, Search, Settings2,
  ShieldCheck, SlidersHorizontal, Users, WalletCards, X,
} from "lucide-react";

const nav = [
  { label: "Overview", icon: LayoutDashboard, count: "" },
  { label: "Members", icon: Users, count: "128" },
  { label: "Accounts", icon: WalletCards, count: "" },
  { label: "Transactions", icon: Activity, count: "6" },
  { label: "Funding", icon: Banknote, count: "" },
  { label: "Wallet controls", icon: LockKeyhole, count: "" },
  { label: "Audit log", icon: FileClock, count: "" },
  { label: "Settings", icon: Settings2, count: "" },
];

const people = [
  { name: "Avery Morgan", email: "avery.morgan@email.com", id: "GL8X2FQ", joined: "Mar 14, 2024", verification: "In review", account: "Active", wallets: "3", initials: "AM", tone: "sage" },
  { name: "Daniel Okafor", email: "daniel.okafor@email.com", id: "GL2K9PD", joined: "Mar 12, 2024", verification: "Verified", account: "Active", wallets: "2", initials: "DO", tone: "sand" },
  { name: "Maya Chen", email: "maya.chen@email.com", id: "GL7M4LA", joined: "Mar 11, 2024", verification: "Verified", account: "Active", wallets: "4", initials: "MC", tone: "blue" },
  { name: "Samuel Wright", email: "sam.wright@email.com", id: "GL5N1XR", joined: "Mar 08, 2024", verification: "Action needed", account: "Review", wallets: "1", initials: "SW", tone: "rose" },
  { name: "Isabella Rossi", email: "isabella.rossi@email.com", id: "GL3J8QB", joined: "Mar 06, 2024", verification: "Verified", account: "Active", wallets: "2", initials: "IR", tone: "lilac" },
];

const movements = [
  { name: "Daniel Okafor", detail: "Wallet funding · USD", amount: "+$2,400.00", time: "10:42 AM", type: "in" },
  { name: "Maya Chen", detail: "International transfer · EUR", amount: "−€840.00", time: "10:18 AM", type: "out" },
  { name: "Avery Morgan", detail: "Wallet conversion · GBP", amount: "+£320.50", time: "9:56 AM", type: "in" },
];

function Pill({ children, kind = "neutral" }: { children: ReactNode; kind?: "good" | "pending" | "alert" | "neutral" }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${kind === "good" ? "bg-[#e8f3ed] text-[#3d745e]" : kind === "pending" ? "bg-[#f8f1df] text-[#90753d]" : kind === "alert" ? "bg-[#f8e9e5] text-[#a45a48]" : "bg-[#edf1f0] text-[#657876]"}`}><span className={`h-1.5 w-1.5 rounded-full ${kind === "good" ? "bg-[#64a486]" : kind === "pending" ? "bg-[#c19c50]" : kind === "alert" ? "bg-[#c5755d]" : "bg-[#97a6a2]"}`} />{children}</span>;
}

export default function Compact() {
  const [active, setActive] = useState("Members");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All members");
  const [selected, setSelected] = useState<(typeof people)[number] | null>(null);
  const [fundingOpen, setFundingOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => people.filter(person => {
    const matchSearch = `${person.name} ${person.email} ${person.id}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All members" || (filter === "Needs review" && person.verification !== "Verified") || (filter === "Verified" && person.verification === "Verified");
    return matchSearch && matchFilter;
  }), [search, filter]);
  const toast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  return (
    <div className="min-h-screen bg-[#f3f6f2] text-[#243b43]">
      {mobileOpen && <button aria-label="Close menu overlay" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-20 bg-[#183640]/35 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[218px] flex-col bg-[#173b49] text-[#dbe8e5] transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}>
        <div className="flex h-[66px] items-center gap-3 border-b border-white/[.09] px-5">
          <div className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#d9c27f] text-[#173b49]"><span className="font-['Manrope'] text-[19px] font-extrabold">G</span></div>
          <div className="leading-none"><p className="font-['Manrope'] text-[15px] font-extrabold tracking-[-.06em] text-white">GLOBUS</p><p className="mt-1.5 text-[8px] font-bold tracking-[.22em] text-[#dfc87f]">BANK · OPERATIONS</p></div>
          <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="ml-auto lg:hidden"><X size={17} /></button>
        </div>
        <div className="mx-3.5 my-4 rounded-[10px] border border-white/[.09] bg-white/[.045] px-3 py-2.5">
          <p className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#9fcec1]"><span className="h-1.5 w-1.5 rounded-full bg-[#7cc6aa]" />Operations live</p>
          <p className="mt-1 text-[10px] text-[#a9c0c1]">Administrative workspace</p>
        </div>
        <p className="px-5 pb-2 text-[8px] font-bold uppercase tracking-[.17em] text-[#839fa4]">Workspace</p>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5">
          {nav.map(({ label, icon: Icon, count }) => (
            <button key={label} onClick={() => { setActive(label); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-[9px] px-3 py-[9px] text-left text-[11px] font-semibold transition-colors ${active === label ? "bg-[#d9c27f] text-[#1d3c48]" : "text-[#c1d2d1] hover:bg-white/[.07] hover:text-white"}`}>
              <Icon size={15} strokeWidth={1.8} /><span className="flex-1">{label}</span>{count && <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active === label ? "bg-[#294956]/10 text-[#254550]" : "bg-white/[.09] text-[#b4c9c8]"}`}>{count}</span>}
            </button>
          ))}
        </nav>
        <div className="mx-3.5 mb-3 rounded-[9px] border border-white/[.08] bg-white/[.035] p-3">
          <div className="flex items-center gap-2 text-[#c7d6d4]"><ShieldCheck size={14} /><span className="text-[10px] font-semibold">Protected workspace</span></div>
          <p className="mt-1.5 pl-[22px] text-[9px] text-[#8fa9aa]">All actions are recorded</p>
        </div>
        <div className="border-t border-white/[.09] p-3">
          <div className="flex items-center gap-2.5 rounded-[9px] bg-white/[.045] p-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d7e8e3] text-[10px] font-bold text-[#244a54]">AD</div>
            <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">Operations admin</p><p className="truncate text-[9px] text-[#9eb5b6]">admin@globus.example</p></div>
            <button aria-label="Sign out" onClick={() => toast("Sign out is unavailable in this preview")} className="rounded-md p-1.5 text-[#afc3c3] hover:bg-white/10"><LogOut size={14} /></button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[218px]">
        <header className="sticky top-0 z-10 flex h-[58px] items-center justify-between border-b border-[#e1e9e4] bg-[#f7f9f5]/95 px-4 backdrop-blur sm:px-7">
          <div className="flex min-w-0 items-center gap-2.5">
            <button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-[#e8efea] lg:hidden"><Menu size={18} /></button>
            <p className="truncate text-[10px] text-[#859492]"><span className="hidden sm:inline">Globus Bank&nbsp; / &nbsp;</span><span className="font-semibold text-[#3e575b]">{active}</span></p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-1.5 rounded-full border border-[#dce7df] bg-[#f0f6f0] px-2.5 py-1.5 sm:flex"><ShieldCheck size={12} className="text-[#57816d]" /><span className="text-[9px] font-semibold text-[#557364]">Authorized</span></div>
            <button aria-label="Notifications" onClick={() => toast("You’re all caught up")} className="relative rounded-lg p-2 text-[#718583] hover:bg-[#e9efea]"><Bell size={16} /><span className="absolute right-[6px] top-[6px] h-1.5 w-1.5 rounded-full bg-[#bf8254]" /></button>
            <div className="grid h-7 w-7 place-items-center rounded-full border border-[#d9e3dd] bg-[#e7efea] text-[9px] font-bold text-[#365963]">AD</div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 pb-8 pt-5 sm:px-7 sm:pt-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[.17em] text-[#578b85]">Customer operations</p><h1 className="mt-1 font-['Manrope'] text-[26px] font-extrabold tracking-[-.055em] text-[#1c3a47] sm:text-[29px]">Member directory</h1><p className="mt-1 text-[11px] text-[#788b89]">Review customer profiles and account access.</p></div>
            <button onClick={() => setFundingOpen(true)} className="inline-flex h-9 items-center gap-2 rounded-[8px] bg-[#1b4351] px-3.5 text-[10px] font-bold text-white shadow-[0_3px_8px_rgba(20,57,68,.12)] transition hover:bg-[#245565]"><Plus size={14} />Add funding</button>
          </div>

          <section className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {[
              { label: "Total members", value: "1,284", note: "+18 this week", icon: Users },
              { label: "Pending verification", value: "12", note: "4 need attention", icon: Clock3 },
              { label: "Active accounts", value: "1,196", note: "93.1% of members", icon: WalletCards },
              { label: "Today's activity", value: "248", note: "Across 6 currencies", icon: Activity },
            ].map(({ label, value, note, icon: Icon }, index) => <div key={label} className={`rounded-[11px] border border-[#e0e8e2] bg-[#fffefa] px-3.5 py-3 shadow-[0_2px_8px_rgba(35,65,62,.025)] sm:px-4 ${index === 3 ? "hidden md:block" : ""}`}>
              <div className="flex items-center justify-between"><span className="text-[9px] font-semibold text-[#82918d]">{label}</span><Icon size={14} className="text-[#82a19a]" /></div><div className="mt-1.5 flex items-baseline gap-2"><strong className="font-['Manrope'] text-[21px] font-extrabold tracking-[-.04em] text-[#24424b]">{value}</strong><span className="hidden text-[9px] text-[#7d9d8b] sm:inline">{note}</span></div>
            </div>)}
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_268px]">
            <section className="min-w-0 overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eeea] px-4 py-3.5 sm:px-5">
                <div><div className="flex items-center gap-2"><h2 className="text-[13px] font-bold text-[#29434a]">Customer records</h2><span className="rounded-full bg-[#eef3ef] px-2 py-0.5 text-[9px] font-semibold text-[#70827e]">1,284</span></div><p className="mt-0.5 text-[9px] text-[#879592]">Member identity and account standing</p></div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <label className="relative min-w-0 flex-1 sm:w-[220px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#91a09d]" /><input value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-full rounded-[7px] border border-[#dfe7e2] bg-[#fcfdfa] pl-8 pr-2 text-[10px] text-[#345057] outline-none placeholder:text-[#9aa8a3] focus:border-[#8eb3a5]" placeholder="Name, email or member ID" /></label>
                  <button onClick={() => setFilter(filter === "All members" ? "Needs review" : filter === "Needs review" ? "Verified" : "All members")} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dfe7e2] px-2.5 text-[10px] font-semibold text-[#657b79] hover:bg-[#f5f8f4]"><Filter size={13} /><span className="hidden sm:inline">{filter === "All members" ? "Filter" : filter}</span><ChevronDown size={12} /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 border-b border-[#edf1ed] px-4 sm:px-5">
                {["All members", "Needs review", "Verified"].map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={`relative py-2.5 text-[10px] font-semibold transition ${filter === tab ? "text-[#2f675f]" : "text-[#899693] hover:text-[#526b69]"}`}>{tab}{tab === "Needs review" && <span className="ml-1.5 rounded-full bg-[#f7efdc] px-1.5 py-0.5 text-[8px] text-[#907b49]">12</span>}{filter === tab && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#52928a]" />}</button>)}
                <button onClick={() => toast("Showing latest member records")} className="ml-auto hidden items-center gap-1 text-[9px] text-[#84928d] sm:flex"><SlidersHorizontal size={12} />Newest first</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[710px] text-left">
                  <thead className="bg-[#f7f9f5] text-[8px] font-bold uppercase tracking-[.11em] text-[#899792]"><tr><th className="px-4 py-2.5 sm:px-5">Member</th><th className="px-3 py-2.5">Verification</th><th className="px-3 py-2.5">Account</th><th className="px-3 py-2.5">Wallets</th><th className="px-4 py-2.5 text-right sm:px-5"> </th></tr></thead>
                  <tbody>{filtered.map(person => <tr key={person.id} className="border-t border-[#edf1ed] transition hover:bg-[#fafbf8]">
                    <td className="px-4 py-3 sm:px-5"><div className="flex items-center gap-2.5"><div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${person.tone === "sage" ? "bg-[#e6f0e9] text-[#47755e]" : person.tone === "sand" ? "bg-[#f4eee0] text-[#8e784e]" : person.tone === "blue" ? "bg-[#e7eef1] text-[#527482]" : person.tone === "rose" ? "bg-[#f5e9e5] text-[#9c6254]" : "bg-[#eeeaf3] text-[#746386]"}`}>{person.initials}</div><div className="min-w-0"><p className="truncate text-[10px] font-bold text-[#344c51]">{person.name}</p><p className="truncate text-[9px] text-[#899793]">{person.email}</p><p className="mt-0.5 font-mono text-[8px] text-[#96a29e]">{person.id} <span className="font-sans">· Joined {person.joined}</span></p></div></div></td>
                    <td className="px-3 py-3"><Pill kind={person.verification === "Verified" ? "good" : person.verification === "Action needed" ? "alert" : "pending"}>{person.verification}</Pill></td>
                    <td className="px-3 py-3"><span className="text-[10px] font-medium text-[#526a67]">{person.account}</span></td>
                    <td className="px-3 py-3"><span className="text-[10px] font-semibold text-[#526a67]">{person.wallets}</span><span className="ml-1 text-[9px] text-[#8f9b97]">wallets</span></td>
                    <td className="px-4 py-3 text-right sm:px-5"><button onClick={() => setSelected(person)} className="rounded-[6px] border border-[#dce6e0] px-2.5 py-1.5 text-[9px] font-bold text-[#47636a] hover:border-[#99b9aa] hover:bg-[#f3f8f4]">View record</button></td>
                  </tr>)}
                  {filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#edf3ee] text-[#769189]"><Search size={16} /></div><p className="mt-2 text-[11px] font-semibold text-[#526b68]">No members found</p><p className="mt-1 text-[9px] text-[#899692]">Try another name, email or member ID.</p></td></tr>}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#e9eeea] px-4 py-2.5 sm:px-5"><p className="text-[9px] text-[#84928e]">Showing <b className="text-[#526b68]">{filtered.length ? "1–5" : "0"}</b> of <b className="text-[#526b68]">1,284</b> members</p><div className="flex items-center gap-1"><button aria-label="Previous page" onClick={() => toast("You’re on the first page")} className="grid h-7 w-7 place-items-center rounded-md border border-[#e1e9e3] text-[#8a9994] hover:bg-[#f5f8f4]"><ChevronLeft size={13} /></button><span className="grid h-7 min-w-7 place-items-center rounded-md bg-[#eaf2ed] px-2 text-[9px] font-bold text-[#476c61]">1</span><button aria-label="Next page" onClick={() => toast("Next page is not available in this preview")} className="grid h-7 w-7 place-items-center rounded-md border border-[#e1e9e3] text-[#8a9994] hover:bg-[#f5f8f4]"><ChevronRight size={13} /></button></div></div>
            </section>

            <aside className="space-y-3">
              <section className="overflow-hidden rounded-[12px] border border-[#dfe8e2] bg-[#fffefa] shadow-[0_3px_12px_rgba(35,65,62,.035)]">
                <div className="flex items-start justify-between border-b border-[#e9eeea] px-4 py-3.5"><div><h2 className="text-[12px] font-bold text-[#29434a]">Ledger activity</h2><p className="mt-0.5 text-[9px] text-[#879592]">Latest account movements</p></div><button aria-label="View all ledger activity" onClick={() => { setActive("Transactions"); toast("Transaction view selected"); }} className="text-[9px] font-bold text-[#52857c] hover:text-[#315f59]">View all</button></div>
                <div className="divide-y divide-[#edf1ed]">
                  {movements.map(move => <div key={move.name} className="flex items-center gap-2.5 px-4 py-3"><div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${move.type === "in" ? "bg-[#e8f2eb] text-[#57816a]" : "bg-[#f5eee4] text-[#a08050]"}`}>{move.type === "in" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}</div><div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold text-[#425958]">{move.name}</p><p className="truncate text-[8px] text-[#899793]">{move.detail}</p><p className="mt-1 text-[8px] text-[#a0aaa6]">{move.time}</p></div><span className={`whitespace-nowrap text-[9px] font-bold ${move.type === "in" ? "text-[#4b8067]" : "text-[#647976]"}`}>{move.amount}</span></div>)}
                </div>
                <button onClick={() => { setActive("Transactions"); toast("Transaction view selected"); }} className="w-full border-t border-[#e9eeea] py-2.5 text-[9px] font-semibold text-[#63827b] hover:bg-[#f7faf6]">Open transaction management</button>
              </section>
              <section className="rounded-[12px] border border-[#e4e9df] bg-[#f7f8f0] px-4 py-3.5">
                <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-[8px] bg-[#e9eddc] text-[#7d895a]"><CircleHelp size={14} /></div><p className="text-[10px] font-bold text-[#4b6158]">Operator note</p></div>
                <p className="mt-2 text-[9px] leading-[1.6] text-[#75857c]">Member changes are recorded in the audit log. Confirm identity before adjusting account access.</p>
                <button onClick={() => { setActive("Audit log"); toast("Audit log selected"); }} className="mt-2 text-[9px] font-bold text-[#63806e] hover:underline">Review audit log</button>
              </section>
            </aside>
          </div>
          <footer className="mt-5 flex items-center justify-between border-t border-[#e1e9e3] pt-3 text-[8px] text-[#98a39f]"><span>Globus Bank · Internal operations</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#77a68b]" />Systems operational</span></footer>
        </main>
      </div>

      {(selected || fundingOpen) && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#17333b]/35 p-4" onMouseDown={e => { if (e.target === e.currentTarget) { setSelected(null); setFundingOpen(false); } }}>
        <div className="w-full max-w-[390px] rounded-[14px] border border-[#dce6df] bg-[#fffefa] p-5 shadow-[0_20px_60px_rgba(25,53,57,.2)]">
          <div className="flex items-start justify-between"><div><p className="text-[8px] font-bold uppercase tracking-[.16em] text-[#598d83]">{selected ? "Member profile" : "Funding operations"}</p><h2 className="mt-1 font-['Manrope'] text-[18px] font-extrabold tracking-[-.04em] text-[#24414a]">{selected ? selected.name : "Add wallet funding"}</h2></div><button aria-label="Close dialog" onClick={() => { setSelected(null); setFundingOpen(false); }} className="rounded-md p-1.5 text-[#7d8d88] hover:bg-[#eef3ee]"><X size={16} /></button></div>
          {selected ? <><div className="mt-4 rounded-[9px] bg-[#f5f8f3] p-3"><p className="text-[10px] text-[#536a68]">{selected.email}</p><p className="mt-1 font-mono text-[9px] text-[#889791]">Member ID · {selected.id}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-[8px] border border-[#e6ece6] p-3"><p className="text-[8px] uppercase tracking-[.1em] text-[#87958e]">Verification</p><div className="mt-1.5"><Pill kind={selected.verification === "Verified" ? "good" : selected.verification === "Action needed" ? "alert" : "pending"}>{selected.verification}</Pill></div></div><div className="rounded-[8px] border border-[#e6ece6] p-3"><p className="text-[8px] uppercase tracking-[.1em] text-[#87958e]">Account state</p><p className="mt-2 text-[10px] font-bold text-[#49635d]">{selected.account}</p></div></div><div className="mt-4 flex gap-2"><button onClick={() => { toast(`Profile opened for ${selected.name}`); setSelected(null); }} className="flex-1 rounded-[7px] bg-[#1b4351] py-2.5 text-[10px] font-bold text-white hover:bg-[#245565]">Manage member</button><button onClick={() => { toast("Account access details opened"); setSelected(null); }} className="rounded-[7px] border border-[#dce6e0] px-3 py-2.5 text-[10px] font-bold text-[#55716e] hover:bg-[#f5f8f4]">Account details</button></div></> : <><p className="mt-2 text-[10px] leading-relaxed text-[#768783]">Create a funding instruction for a member wallet. This preview does not submit financial activity.</p><label className="mt-4 block text-[9px] font-semibold text-[#687c77]">Member ID<input placeholder="Search by name or member ID" className="mt-1.5 h-9 w-full rounded-[7px] border border-[#dce6e0] bg-[#fcfdfa] px-3 text-[10px] outline-none focus:border-[#8eb3a5]" /></label><label className="mt-3 block text-[9px] font-semibold text-[#687c77]">Amount<input placeholder="0.00" inputMode="decimal" className="mt-1.5 h-9 w-full rounded-[7px] border border-[#dce6e0] bg-[#fcfdfa] px-3 text-[10px] outline-none focus:border-[#8eb3a5]" /></label><div className="mt-3 flex gap-2"><button onClick={() => { toast("Funding request saved locally"); setFundingOpen(false); }} className="flex-1 rounded-[7px] bg-[#1b4351] py-2.5 text-[10px] font-bold text-white hover:bg-[#245565]">Review request</button><button onClick={() => setFundingOpen(false)} className="rounded-[7px] border border-[#dce6e0] px-3 py-2.5 text-[10px] font-bold text-[#55716e]">Cancel</button></div></>}
        </div>
      </div>}
      {notice && <div role="status" className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-[9px] bg-[#204653] px-4 py-3 text-[10px] font-semibold text-white shadow-lg"><ShieldCheck size={14} />{notice}</div>}
    </div>
  );
}
