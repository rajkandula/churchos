import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Event } from "@/models/Event";
import { Registration } from "@/models/Registration";
import { jsonError, readBody, withApi } from "@/lib/api-helpers";
import { findChurchByCode } from "@/lib/public-church";
import {
  EMAIL_RE,
  PHONE_RE,
  findDuplicateRegistration,
  registeredCounts,
  spotsLeftFor,
} from "@/lib/events";

type Params = { params: Promise<{ church: string; slug: string }> };

const SLUG_RE = /^[a-z0-9]{4,32}$/;

/** Resolve church code + event slug — drafts are invisible to the public. */
async function resolve(churchCode: string, slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  const church = await findChurchByCode(decodeURIComponent(churchCode));
  if (!church) return null;
  const event = await Event.findOne({
    churchId: church._id,
    publicSlug: slug,
    status: { $ne: "draft" },
  }).lean();
  if (!event) return null;
  return { church, event };
}

function publicShape(
  church: { name: string; logoUrl?: string; address?: string; currency?: string },
  event: {
    _id: unknown;
    title: string;
    description?: string;
    startAt: Date;
    endAt?: Date | null;
    venue?: string;
    coverUrl?: string;
    capacity?: number | null;
    registrationOpen?: boolean;
    fee?: number;
    status: string;
    organizerName?: string;
  },
  registeredCount: number
) {
  const spotsLeft = spotsLeftFor(event.capacity, registeredCount);
  return {
    church: {
      name: church.name,
      logoUrl: church.logoUrl ?? "",
      address: church.address ?? "",
      currency: church.currency ?? "INR",
    },
    event: {
      _id: String(event._id),
      title: event.title,
      description: event.description ?? "",
      startAt: event.startAt,
      endAt: event.endAt ?? null,
      venue: event.venue ?? "",
      coverUrl: event.coverUrl ?? "",
      capacity: event.capacity ?? null,
      registrationOpen: Boolean(event.registrationOpen),
      fee: event.fee ?? 0,
      status: event.status,
      organizerName: event.organizerName ?? "",
      spotsLeft,
      // Ready-made flag so the page doesn't reimplement the rules
      canRegister: event.status === "published" && Boolean(event.registrationOpen),
    },
  };
}

/** Public: event details for the registration page. No session. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const { church: churchCode, slug } = await params;
    await connectDb();
    const found = await resolve(churchCode, slug);
    if (!found) return jsonError("Event not found.", 404);
    const counts = await registeredCounts(String(found.church._id), [found.event._id]);
    return NextResponse.json(
      publicShape(found.church, found.event, counts.get(String(found.event._id)) ?? 0)
    );
  });
}

/** Public: register for the event. Waitlists when full; rejects duplicates. */
export async function POST(req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const { church: churchCode, slug } = await params;
    const body = await readBody(req);

    const name = String(body.name ?? "").trim().slice(0, 120);
    const phone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const guests = Number(String(body.guests ?? "0").trim() || 0);
    const notes = String(body.notes ?? "").trim().slice(0, 1000);

    if (!name) return jsonError("Please enter your name.");
    if (!phone && !email)
      return jsonError("Add a phone number or email so we can reach you.");
    if (phone && !PHONE_RE.test(phone))
      return jsonError("Please enter a valid phone number.");
    if (email && !EMAIL_RE.test(email))
      return jsonError("Please enter a valid email address.");
    if (!Number.isInteger(guests) || guests < 0 || guests > 20)
      return jsonError("Guests must be a whole number between 0 and 20.");

    await connectDb();
    const found = await resolve(churchCode, slug);
    if (!found) return jsonError("Event not found.", 404);
    const { church, event } = found;
    const churchId = String(church._id);

    if (event.status === "cancelled")
      return jsonError("This event has been cancelled.", 409);
    if (event.status !== "published" || !event.registrationOpen)
      return jsonError("Registration for this event is closed.", 409);

    // Light abuse guard: one live signup per phone/email per event
    const dup = await findDuplicateRegistration(churchId, event._id, phone, email);
    if (dup)
      return jsonError(
        dup.status === "waitlisted"
          ? "You're already on the waitlist for this event."
          : "You're already registered for this event.",
        409
      );

    const counts = await registeredCounts(churchId, [event._id]);
    const registeredCount = counts.get(String(event._id)) ?? 0;
    const seatsWanted = 1 + guests;
    const full =
      event.capacity !== null &&
      event.capacity !== undefined &&
      registeredCount + seatsWanted > event.capacity;

    const registration = await Registration.create({
      churchId,
      event: event._id,
      person: null,
      name,
      phone,
      email,
      guests,
      notes,
      status: full ? "waitlisted" : "registered",
      source: "public",
      registeredAt: new Date(),
    });

    return NextResponse.json(
      {
        ok: true,
        status: registration.status,
        registration: {
          _id: String(registration._id),
          name: registration.name,
          guests: registration.guests,
          status: registration.status,
        },
        spotsLeft: spotsLeftFor(
          event.capacity,
          registeredCount + (full ? 0 : seatsWanted)
        ),
      },
      { status: 201 }
    );
  });
}
