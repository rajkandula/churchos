"use client";

import {
  Building2,
  LayoutDashboard,
  FileText,
  Inbox,
  Mail,
  Send,
  Shield,
  ShieldOff,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api, formatDate, formatDateTime } from "@/lib/client-api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatMoney } from "@/lib/money";

type Overview = {
  year: string;
  stats: {
    churches: number;
    users: number;
    people: number;
    members: number;
    driveFiles: number;
    donations: number;
    groups: number;
    events: number;
    newMessages: number;
    pendingApprovals?: number;
  };
  churches: {
    churchName: string;
    churchCode: string;
    admins: number;
    currency: string;
    people: number;
    givingTotal: number;
    createdAt: string | null;
  }[];
  users: {
    _id: string;
    name: string;
    username: string;
    email: string;
    role: string;
    status: string;
    churchName: string;
    createdAt: string;
  }[];
};

type Message = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  churchName?: string;
  message: string;
  status: "new" | "handled";
  createdAt: string;
};

type SentItem = {
  _id: string;
  to: string;
  subject: string;
  text: string;
  kind: "compose" | "reply";
  sentAt: string;
};

type MailItem = {
  _id: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  read: boolean;
  replies: { text: string; sentAt: string }[];
  receivedAt: string;
};


export default function AdminPage() {
  const toast = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [section, setSection] = useState<
    "overview" | "users" | "enquiries" | "mailbox"
  >("overview");
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [mails, setMails] = useState<MailItem[] | null>(null);
  const [sentMails, setSentMails] = useState<SentItem[]>([]);
  const [mailTab, setMailTab] = useState<"inbox" | "sent">("inbox");
  const [openSentId, setOpenSentId] = useState<string | null>(null);
  const [openMailId, setOpenMailId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState({ to: "", subject: "", text: "" });
  const [composing, setComposing] = useState(false);
  const [mailbox, setMailbox] = useState({ address: "", inboundEnabled: false });

  async function sendCompose() {
    setComposing(true);
    try {
      await api("/api/admin/mail/compose", { method: "POST", json: compose });
      toast.success(`Sent to ${compose.to}.`);
      setComposeOpen(false);
      setCompose({ to: "", subject: "", text: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setComposing(false);
    }
  }

  const load = useCallback(() => {
    api<Overview>("/api/admin/overview")
      .then(setData)
      .catch(() => setData(null));
    api<{ messages: Message[] }>("/api/admin/contact")
      .then((m) => setMessages(m.messages))
      .catch(() => setMessages([]));
    api<{
      emails: MailItem[];
      sent?: SentItem[];
      mailbox?: string;
      inboundEnabled?: boolean;
    }>("/api/admin/mail")
      .then((inbox) => {
        setMails(inbox.emails);
        setSentMails(inbox.sent ?? []);
        setMailbox({
          address: inbox.mailbox ?? "",
          inboundEnabled: Boolean(inbox.inboundEnabled),
        });
      })
      .catch(() => setMails([]));
  }, []);

  function openMail(m: MailItem) {
    const next = openMailId === m._id ? null : m._id;
    setOpenMailId(next);
    setReplyText("");
    if (next && !m.read) {
      api("/api/admin/mail", { method: "PATCH", json: { id: m._id, read: true } })
        .then(() =>
          setMails((prev) =>
            prev ? prev.map((x) => (x._id === m._id ? { ...x, read: true } : x)) : prev
          )
        )
        .catch(() => {});
    }
  }

  async function sendReply(id: string) {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api("/api/admin/mail/reply", { method: "POST", json: { id, text: replyText } });
      toast.success("Reply sent.");
      setReplyText("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setReplying(false);
    }
  }

  async function deleteMail(id: string) {
    try {
      await api("/api/admin/mail", { method: "DELETE", json: { id } });
      setMails((prev) => (prev ? prev.filter((x) => x._id !== id) : prev));
      if (openMailId === id) setOpenMailId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Deep link ?tab=… — applied after mount so the server and client
    // first paint agree.
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "users" || t === "enquiries" || t === "mailbox")
      queueMicrotask(() => setSection(t));
  }, []);

  function goSection(key: "overview" | "users" | "enquiries" | "mailbox") {
    setSection(key);
    window.history.replaceState(
      null,
      "",
      key === "overview" ? "/admin" : `/admin?tab=${key}`
    );
  }

  async function setRole(userId: string, role: "admin" | "superadmin") {
    try {
      await api("/api/admin/users", { method: "PATCH", json: { id: userId, role } });
      toast.success(role === "superadmin" ? "Made company admin." : "Company access removed.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function setStatus(userId: string, status: "approved" | "rejected") {
    try {
      await api("/api/admin/users", { method: "PATCH", json: { id: userId, status } });
      toast.success(
        status === "approved"
          ? "Approved — they've been emailed and can sign in now."
          : "Registration rejected."
      );
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    }
  }

  async function setMessageStatus(id: string, status: "new" | "handled") {
    try {
      await api("/api/admin/contact", { method: "PATCH", json: { id, status } });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update.");
    }
  }

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Company overview
      </h1>
      <p className="mt-1.5 text-slate-500">
        Every church on the platform — operations, people and enquiries.
      </p>

      <div className="mt-8 flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-52 lg:shrink-0">
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:flex-col lg:pb-0">
            {(
              [
                { key: "overview", label: "Overview", Icon: LayoutDashboard, badge: 0 },
                {
                  key: "users",
                  label: "Users",
                  Icon: Users,
                  badge: data?.stats.pendingApprovals ?? 0,
                },
                {
                  key: "enquiries",
                  label: "Enquiries",
                  Icon: Inbox,
                  badge: messages?.filter((m) => m.status === "new").length ?? 0,
                },
                {
                  key: "mailbox",
                  label: "Mailbox",
                  Icon: Mail,
                  badge: mails?.filter((m) => !m.read).length ?? 0,
                },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => goSection(item.key)}
                className={`flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                  section === item.key
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-900"
                }`}
              >
                <item.Icon className="h-4 w-4" aria-hidden />
                {item.label}
                {item.badge > 0 && (
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      section === item.key
                        ? "bg-white/20 text-white"
                        : "bg-indigo-600 text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">

      {/* Platform stats */}
      {data && (
        <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${section === "overview" ? "" : "hidden"}`}>
          {[
            { label: "Churches", value: data.stats.churches },
            { label: "User accounts", value: data.stats.users },
            { label: "People", value: data.stats.people },
            { label: "Members", value: data.stats.members },
            { label: "Drive files", value: data.stats.driveFiles },
            { label: "Gifts this year", value: data.stats.donations },
            { label: "Groups", value: data.stats.groups },
            { label: "New enquiries", value: data.stats.newMessages },
            { label: "Pending approvals", value: data.stats.pendingApprovals ?? 0 },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                {t.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Churches */}
      <section className={`mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${section === "overview" ? "" : "hidden"}`}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Building2 className="h-4 w-4 text-indigo-500" aria-hidden />
          <h2 className="text-sm font-bold text-slate-900">Churches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-5 py-3">Church</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3 text-right">Admins</th>
                <th className="px-4 py-3 text-right">People</th>
                <th className="px-4 py-3 text-right">Giving ({data?.year})</th>
                <th className="px-4 py-3">Since</th>
              </tr>
            </thead>
            <tbody>
              {data?.churches.map((s) => (
                <tr key={s.churchCode} className="border-b border-slate-50">
                  <td className="px-5 py-3 font-semibold text-slate-900">{s.churchName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-indigo-600">{s.churchCode}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.admins}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{s.people}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {formatMoney(s.givingTotal, s.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        {/* Users */}
        <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${section === "users" ? "" : "hidden"}`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Users className="h-4 w-4 text-indigo-500" aria-hidden />
            <h2 className="text-sm font-bold text-slate-900">User accounts</h2>
          </div>
          <ul className="divide-y divide-slate-50">
            {data?.users.map((u) => (
              <li
                key={u._id}
                className={`flex items-center gap-3 px-5 py-3.5 ${
                  u.status === "pending" ? "bg-amber-50/50" : ""
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-xs font-bold text-indigo-600">
                  {u.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {u.name}
                    {u.role === "superadmin" && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        Company admin
                      </span>
                    )}
                    {u.status === "pending" && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        Awaiting approval
                      </span>
                    )}
                    {u.status === "rejected" && (
                      <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                        Rejected
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    @{u.username} · {u.email} · {u.churchName}
                  </p>
                </div>
                {u.status === "pending" ? (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => setStatus(u._id, "approved")}
                      className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setStatus(u._id, "rejected")}
                      className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors duration-200 hover:bg-rose-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : u.status === "rejected" ? (
                  <button
                    onClick={() => setStatus(u._id, "approved")}
                    className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors duration-200 hover:bg-emerald-50"
                  >
                    Approve anyway
                  </button>
                ) : u.role === "superadmin" ? (
                  <button
                    onClick={() => setRole(u._id, "admin")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-400 transition-colors duration-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                    Revoke
                  </button>
                ) : (
                  <button
                    onClick={() => setRole(u._id, "superadmin")}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-indigo-600 transition-colors duration-200 hover:bg-indigo-50"
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden />
                    Make admin
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Contact inbox */}
        <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${section === "enquiries" ? "" : "hidden"}`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Inbox className="h-4 w-4 text-indigo-500" aria-hidden />
            <h2 className="text-sm font-bold text-slate-900">Enquiries</h2>
            <span className="text-xs text-slate-400">
              from the public <span className="font-mono">/contact</span> page
            </span>
          </div>
          {messages?.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <FileText className="h-8 w-8 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm text-slate-500">
                No enquiries yet. Share the /contact page with prospective
                churches.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {messages?.map((m) => (
                <li key={m._id} className={`px-5 py-4 ${m.status === "handled" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {m.name}
                        {m.churchName && (
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {m.churchName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {[m.email, m.phone].filter(Boolean).join(" · ")} ·{" "}
                        {formatDateTime(m.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant={m.status === "new" ? "secondary" : "ghost"}
                      onClick={() =>
                        setMessageStatus(m._id, m.status === "new" ? "handled" : "new")
                      }
                      className="h-8 px-3 text-xs"
                    >
                      {m.status === "new" ? "Mark handled" : "Reopen"}
                    </Button>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {m.message}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Mailbox — mail received through the inbound-mail webhook */}
        <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${section === "mailbox" ? "" : "hidden"}`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
            <Mail className="h-4 w-4 text-indigo-500" aria-hidden />
            <h2 className="text-sm font-bold text-slate-900">Mailbox</h2>
            {mailbox.address && (
              <span className="text-xs text-slate-400">
                mail sent to <span className="font-mono">{mailbox.address}</span>
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-lg bg-slate-100 p-0.5">
                {(["inbox", "sent"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMailTab(t)}
                    className={`cursor-pointer rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors duration-150 ${
                      mailTab === t
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setComposeOpen(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-indigo-700"
              >
                <Send className="h-3.5 w-3.5" aria-hidden />
                Compose
              </button>
            </div>
          </div>
          {mailTab === "sent" ? (
            sentMails.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Send className="h-8 w-8 text-slate-300" aria-hidden />
                <p className="mt-3 text-sm text-slate-500">
                  Nothing sent yet — composes and replies will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {sentMails.map((s) => (
                  <li key={s._id}>
                    <button
                      onClick={() =>
                        setOpenSentId(openSentId === s._id ? null : s._id)
                      }
                      className="w-full cursor-pointer px-5 py-4 text-left transition-colors duration-150 hover:bg-slate-50/60"
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {s.subject}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.kind === "reply"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-indigo-50 text-indigo-600"
                          }`}
                        >
                          {s.kind}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        To {s.to} · {formatDateTime(s.sentAt)}
                      </p>
                    </button>
                    {openSentId === s._id && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                          {s.text || "(no text stored for this message)"}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )
          ) : mails?.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <Mail className="h-8 w-8 text-slate-300" aria-hidden />
              <p className="mt-3 text-sm text-slate-500">
                {mailbox.inboundEnabled
                  ? "No mail yet. Mail forwarded to the inbound-mail webhook will appear here."
                  : "Inbound mail is off. Set INBOUND_MAIL_SECRET and forward your inbox to /api/mail/inbound to receive mail here."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {mails?.map((m) => (
                <li key={m._id}>
                  <button
                    onClick={() => openMail(m)}
                    className="flex w-full cursor-pointer items-start justify-between gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-slate-50/60"
                  >
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm ${
                          m.read ? "font-medium text-slate-600" : "font-bold text-slate-900"
                        }`}
                      >
                        {m.subject}
                        {m.replies.length > 0 && (
                          <span className="ml-2 text-xs font-medium text-emerald-600">
                            replied
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {m.fromName ? `${m.fromName} · ` : ""}
                        {m.from} · {formatDateTime(m.receivedAt)}
                      </p>
                    </div>
                    {!m.read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                    )}
                  </button>
                  {openMailId === m._id && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                        {m.text || "(no text content)"}
                      </p>
                      {m.replies.map((r, i) => (
                        <div
                          key={i}
                          className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3"
                        >
                          <p className="text-xs font-semibold text-indigo-500">
                            You replied · {formatDateTime(r.sentAt)}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                            {r.text}
                          </p>
                        </div>
                      ))}
                      <div className="mt-4 flex items-end gap-2">
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${m.fromName || m.from}…`}
                          className="min-h-[3rem] flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                        />
                        <Button
                          onClick={() => sendReply(m._id)}
                          loading={replying}
                          disabled={!replyText.trim()}
                          className="h-10"
                        >
                          <Send className="h-4 w-4" aria-hidden />
                          Reply
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => deleteMail(m._id)}
                          className="h-10 px-3 text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400">
                        {mailbox.address
                          ? `Replies to this go to ${mailbox.address}.`
                          : "Set CONTACT_EMAIL so their answer reaches your inbox."}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">New email</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {mailbox.address
                ? `Replies go to ${mailbox.address}.`
                : "Set CONTACT_EMAIL to receive replies."}
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="email"
                value={compose.to}
                onChange={(e) => setCompose((c) => ({ ...c, to: e.target.value }))}
                placeholder="To — email address"
                aria-label="Recipient"
                className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
              />
              <input
                value={compose.subject}
                onChange={(e) => setCompose((c) => ({ ...c, subject: e.target.value }))}
                placeholder="Subject"
                aria-label="Subject"
                className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
              />
              <textarea
                rows={6}
                value={compose.text}
                onChange={(e) => setCompose((c) => ({ ...c, text: e.target.value }))}
                placeholder="Write your message…"
                aria-label="Message"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={sendCompose}
                loading={composing}
                disabled={!compose.to || !compose.subject || !compose.text}
              >
                <Send className="h-4 w-4" aria-hidden />
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
