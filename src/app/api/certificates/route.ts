import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Certificate } from "@/models/Certificate";
import { Person } from "@/models/Person";
import { Church } from "@/models/Church";
import { jsonError, readBody, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { seqLabel, withSeqRetry } from "@/lib/seq";
import { logActivity } from "@/lib/audit";
import {
  CERTIFICATE_LABELS,
  DEFAULT_VERSES,
  MILESTONE_FIELDS,
  isCertificateType,
  parseDate,
  shapeCertificate,
} from "@/lib/certificates";

/** Issued certificates, newest first, plus per-type counts for the tiles. */
export async function GET(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("certificates");
    await connectDb();

    const params = req.nextUrl.searchParams;
    const filter: Record<string, unknown> = { churchId: user.churchId };
    const q = (params.get("q") ?? "").trim();
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ "data.personName": re }, { serialNo: re }];
    }
    const type = (params.get("type") ?? "").trim();
    if (type && isCertificateType(type)) filter.type = type;
    const person = (params.get("person") ?? "").trim();
    if (person && isValidObjectId(person)) filter.person = person;
    const limit = Math.min(1000, Number(params.get("limit")) || 500);

    const [certificates, grouped] = await Promise.all([
      Certificate.find(filter)
        .sort({ issuedAt: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
      Certificate.aggregate<{ _id: string; count: number }>([
        { $match: { churchId: new Types.ObjectId(user.churchId) } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
    ]);
    const counts: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      counts[g._id] = g.count;
      total += g.count;
    }

    return NextResponse.json({
      certificates: certificates.map(shapeCertificate),
      counts,
      total,
    });
  });
}

/** Issue a certificate — snapshots the person + church, allocates a serial,
 *  and fills in the person's milestone date if it was still blank. */
export async function POST(req: NextRequest) {
  return withApi(async () => {
    const user = await requireChurch("certificates");
    const body = await readBody(req);

    const type = String(body.type ?? "").trim();
    if (!isCertificateType(type)) return jsonError("Please choose a certificate type.");
    const personId = String(body.person ?? "").trim();
    if (!personId || !isValidObjectId(personId))
      return jsonError("Please choose a person.");
    const spouseId = String(body.spouse ?? "").trim();
    if (type === "marriage" && !spouseId)
      return jsonError("Please choose the spouse for a marriage certificate.");
    if (spouseId && !isValidObjectId(spouseId)) return jsonError("Spouse not found.");
    if (spouseId && spouseId === personId)
      return jsonError("The spouse must be a different person.");
    if (body.eventDate && !parseDate(body.eventDate))
      return jsonError("Please enter a valid date.");

    await connectDb();
    const [person, spouse, church] = await Promise.all([
      Person.findOne({ _id: personId, churchId: user.churchId }).lean(),
      spouseId
        ? Person.findOne({ _id: spouseId, churchId: user.churchId }).lean()
        : Promise.resolve(null),
      Church.findById(user.churchId).lean(),
    ]);
    if (!person) return jsonError("Person not found.");
    if (spouseId && !spouse) return jsonError("Spouse not found.");
    if (!church) return jsonError("Church not found.", 404);

    // Event date: the form's value, else the person's own milestone record,
    // else today for an appreciation (it has no milestone).
    const milestoneField = MILESTONE_FIELDS[type];
    let eventDate = parseDate(body.eventDate);
    if (!eventDate && milestoneField && person[milestoneField])
      eventDate = new Date(person[milestoneField] as Date);
    if (!eventDate && type === "appreciation") eventDate = new Date();
    if (!eventDate)
      return jsonError(
        `Please enter the ${CERTIFICATE_LABELS[type].toLowerCase()} date.`
      );

    const str = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
    const place =
      str(body.place) || (type === "baptism" ? person.baptismPlace ?? "" : "");
    const data = {
      personName: person.name,
      memberNo: person.memberNo,
      dob: person.dob ?? null,
      gender: person.gender ?? "",
      fatherName: str(body.fatherName, 120),
      motherName: str(body.motherName, 120),
      spouseName: spouse?.name ?? "",
      eventDate,
      place,
      officiant: str(body.officiant, 120) || church.pastorName || "",
      witnesses: str(body.witnesses, 240),
      verse: str(body.verse, 600) || DEFAULT_VERSES[type],
      remark: str(body.remark, 600),
      churchName: church.name,
      churchAddress: church.address ?? "",
      logoUrl: church.logoUrl ?? "",
      pastorName: church.pastorName ?? "",
    };

    const certificate = await withSeqRetry(async (attempt) => {
      const seq =
        (await Certificate.countDocuments({ churchId: user.churchId })) + 1 + attempt;
      return Certificate.create({
        churchId: user.churchId,
        serialNo: seqLabel("C", seq),
        type,
        person: person._id,
        spouse: spouse?._id ?? null,
        data,
        issuedAt: new Date(),
        issuedBy: user.name,
        createdBy: new Types.ObjectId(user.id),
      });
    });
    if (!certificate)
      return jsonError("Could not allocate a serial number. Try again.", 500);

    await logActivity(
      user,
      "create",
      "certificate",
      `${certificate.serialNo} — ${CERTIFICATE_LABELS[type]} · ${person.name}`,
      certificate._id
    );

    // Write the milestone back to the register when it was blank — issuing
    // a baptism certificate is the moment the office learns the date.
    if (milestoneField) {
      const targets = [person, ...(type === "marriage" && spouse ? [spouse] : [])];
      for (const p of targets) {
        const set: Record<string, unknown> = {};
        if (!p[milestoneField]) set[milestoneField] = eventDate;
        if (type === "baptism" && !p.baptismPlace && place) set.baptismPlace = place;
        if (Object.keys(set).length === 0) continue;
        await Person.updateOne({ _id: p._id, churchId: user.churchId }, { $set: set });
        await logActivity(
          user,
          "update",
          "person",
          `${p.name} (${p.memberNo}) — ${CERTIFICATE_LABELS[type].toLowerCase()} date recorded from ${certificate.serialNo}`,
          p._id
        );
      }
    }

    return NextResponse.json(
      { certificate: shapeCertificate(certificate.toObject()) },
      { status: 201 }
    );
  });
}
