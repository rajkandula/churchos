import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Certificate } from "@/models/Certificate";
import { jsonError, requireChurch, withApi } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/person-fields";
import { moveToRecycleBin } from "@/lib/audit";
import { CERTIFICATE_LABELS, shapeCertificate } from "@/lib/certificates";

type Params = { params: Promise<{ id: string }> };

/** One certificate with its frozen snapshot — what the print page renders. */
export async function GET(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("certificates");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Certificate not found.", 404);

    await connectDb();
    const certificate = await Certificate.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!certificate) return jsonError("Certificate not found.", 404);

    return NextResponse.json({ certificate: shapeCertificate(certificate) });
  });
}

// Certificates are immutable — there is no PATCH. Reissue instead.

export async function DELETE(_req: NextRequest, { params }: Params) {
  return withApi(async () => {
    const user = await requireChurch("certificates");
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Certificate not found.", 404);

    await connectDb();
    const certificate = await Certificate.findOne({
      _id: id,
      churchId: user.churchId,
    }).lean();
    if (!certificate) return jsonError("Certificate not found.", 404);

    await moveToRecycleBin({
      user,
      itemType: "certificate",
      label: `${certificate.serialNo} — ${CERTIFICATE_LABELS[certificate.type]} · ${certificate.data.personName}`,
      doc: certificate,
    });
    await Certificate.deleteOne({ _id: id, churchId: user.churchId });

    return NextResponse.json({ ok: true });
  });
}
