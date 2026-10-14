import type { Metadata } from "next";
import { CalendarDays, CalendarX2, Clock, Lock, MapPin, Users, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
import { withDbRetry } from "@/lib/db";
import { Event } from "@/models/Event";
import { findChurchByCode } from "@/lib/public-church";
import { registeredCounts, spotsLeftFor } from "@/lib/events";
import { formatMoney } from "@/lib/money";
import { PublicNav } from "@/components/marketing/PublicNav";
import { PublicFooter } from "@/components/marketing/PublicFooter";
import { formatEventRange } from "@/app/dashboard/events/types";
import { RegisterForm } from "./RegisterForm";

type Params = { params: Promise<{ church: string; slug: string }> };

const SLUG_RE = /^[a-z0-9]{4,32}$/;

async function loadEvent(churchCode: string, slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  return withDbRetry(async () => {
    const church = await findChurchByCode(decodeURIComponent(churchCode));
    if (!church) return null;
    const event = await Event.findOne({
      churchId: church._id,
      publicSlug: slug,
      status: { $ne: "draft" },
    }).lean();
    if (!event) return null;
    const counts = await registeredCounts(String(church._id), [event._id]);
    const registeredCount = counts.get(String(event._id)) ?? 0;
    return { church, event, registeredCount };
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { church, slug } = await params;
  try {
    const found = await loadEvent(church, slug);
    if (!found) return { title: "Event not found — ChurchOS" };
    return {
      title: `${found.event.title} — ${found.church.name}`,
      description: found.event.description?.slice(0, 160) || `Register for ${found.event.title}.`,
    };
  } catch {
    return { title: "Event registration — ChurchOS" };
  }
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
        <Icon className="h-5 w-5 text-indigo-600" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
  tone: "rose" | "slate";
}) {
  const tint =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-2xl border p-8 text-center ${tint}`}>
      <Icon className="mx-auto h-10 w-10 opacity-70" aria-hidden />
      <h2 className="mt-4 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm opacity-80">{body}</p>
    </div>
  );
}

export default async function PublicRegisterPage({ params }: Params) {
  const { church: churchCode, slug } = await params;
  const session = await getSession();

  let found: Awaited<ReturnType<typeof loadEvent>> = null;
  let loadFailed = false;
  try {
    found = await loadEvent(churchCode, slug);
  } catch (err) {
    console.error("public event page failed:", err);
    loadFailed = true;
  }

  if (!found) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <PublicNav signedIn={Boolean(session)} />
        <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-4 py-20 sm:px-6">
          <div className="w-full animate-fade-up">
            <Notice
              icon={CalendarX2}
              tone="slate"
              title={loadFailed ? "We couldn't load this event" : "Event not found"}
              body={
                loadFailed
                  ? "Please try again in a moment."
                  : "This link may have expired or been typed incorrectly. Check with the church for the latest link."
              }
            />
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  const { church, event, registeredCount } = found;
  const spotsLeft = spotsLeftFor(event.capacity, registeredCount);
  const currency = church.currency ?? "INR";
  const isPast = (event.endAt ?? event.startAt) < new Date();
  const canRegister =
    event.status === "published" && Boolean(event.registrationOpen) && !isPast;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicNav signedIn={Boolean(session)} />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_60%)]" />
          <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 sm:px-6 lg:pt-14">
            {/* Church identity */}
            <div className="flex items-center gap-3 animate-fade-up">
              {church.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={church.logoUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white">
                  {church.name
                    .split(/\s+/)
                    .map((w: string) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-indigo-600 uppercase">
                  You&apos;re invited by
                </p>
                <p className="font-bold text-slate-900">{church.name}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
              {/* Event details */}
              <div className="animate-fade-up">
                {event.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.coverUrl}
                    alt=""
                    className="h-56 w-full rounded-2xl border border-slate-200 object-cover shadow-xl shadow-indigo-600/10 sm:h-72"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 shadow-xl shadow-indigo-600/10">
                    <CalendarDays className="h-12 w-12 text-white/60" aria-hidden />
                  </div>
                )}
                <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  {event.title}
                </h1>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Detail
                    icon={Clock}
                    label="When"
                    value={formatEventRange(event.startAt, event.endAt)}
                  />
                  {event.venue && <Detail icon={MapPin} label="Where" value={event.venue} />}
                  <Detail
                    icon={Wallet}
                    label="Fee"
                    value={
                      event.fee && event.fee > 0
                        ? `${formatMoney(event.fee, currency)} per person, paid at the venue`
                        : "Free"
                    }
                  />
                  {event.capacity !== null && event.capacity !== undefined && (
                    <Detail
                      icon={Users}
                      label="Capacity"
                      value={
                        spotsLeft === 0
                          ? `Full (${event.capacity} seats) — waitlist open`
                          : `${spotsLeft} of ${event.capacity} spots left`
                      }
                    />
                  )}
                  {event.organizerName && (
                    <Detail icon={Users} label="Organizer" value={event.organizerName} />
                  )}
                </div>

                {event.description && (
                  <div className="mt-8">
                    <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      About this event
                    </h2>
                    <p className="mt-3 leading-relaxed whitespace-pre-line text-slate-600">
                      {event.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Form / state */}
              <div className="animate-fade-up [animation-delay:120ms] lg:sticky lg:top-24">
                {event.status === "cancelled" ? (
                  <Notice
                    icon={CalendarX2}
                    tone="rose"
                    title="This event has been cancelled"
                    body="Sorry — registration is no longer possible. Contact the church if you have questions."
                  />
                ) : event.status === "completed" || isPast ? (
                  <Notice
                    icon={CalendarDays}
                    tone="slate"
                    title="This event has already happened"
                    body="Registration is closed. Keep an eye out for the next one."
                  />
                ) : !canRegister ? (
                  <Notice
                    icon={Lock}
                    tone="slate"
                    title="Registration is closed"
                    body="The church isn't taking signups for this event right now. Contact them directly if you'd like to attend."
                  />
                ) : (
                  <RegisterForm
                    church={churchCode}
                    slug={slug}
                    eventTitle={event.title}
                    spotsLeft={spotsLeft}
                  />
                )}
                {church.address && (
                  <p className="mt-4 text-center text-xs text-slate-400">{church.address}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
