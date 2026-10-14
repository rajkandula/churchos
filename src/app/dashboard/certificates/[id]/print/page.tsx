"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";
import { PrintButton } from "@/components/PrintButton";
import {
  CERTIFICATE_TITLES,
  formatCertificateDate,
  type CertificateDto,
} from "../../types";

const SERIF = "'Cormorant Garamond', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

function Strong({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-slate-900">{children}</span>;
}

/** The type-specific wording that follows "This certifies that {name}". */
function wording(c: CertificateDto): ReactNode {
  const d = c.data;
  const date = <Strong>{formatCertificateDate(d.eventDate)}</Strong>;
  const at = d.place ? (
    <>
      {" "}
      at <Strong>{d.place}</Strong>
    </>
  ) : null;
  switch (c.type) {
    case "baptism":
      return (
        <>
          was baptised in the name of the Father, the Son and the Holy Spirit
          on {date}
          {at}
        </>
      );
    case "dedication": {
      const parents = [d.fatherName, d.motherName].filter(Boolean);
      return (
        <>
          was dedicated to the Lord
          {parents.length > 0 && (
            <>
              {" "}
              by their parents{" "}
              {parents.map((p, i) => (
                <span key={p}>
                  {i > 0 && " and "}
                  <Strong>{p}</Strong>
                </span>
              ))}
            </>
          )}{" "}
          on {date}
          {at}
        </>
      );
    }
    case "marriage":
      return (
        <>
          and <Strong>{d.spouseName || "—"}</Strong> were united in holy
          matrimony on {date}
          {at}
        </>
      );
    case "membership":
      return (
        <>
          was received into the membership of{" "}
          <Strong>{d.churchName || "the church"}</Strong> on {date}
        </>
      );
    case "confirmation":
      return (
        <>
          was confirmed in the faith on {date}
          {at}
        </>
      );
    case "appreciation":
      return (
        <>
          is honoured for faithful service
          {d.remark ? <> — {d.remark}</> : null}
        </>
      );
  }
}

export default function CertificatePrintPage() {
  const { id } = useParams<{ id: string }>();
  const [certificate, setCertificate] = useState<CertificateDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<{ certificate: CertificateDto }>(`/api/certificates/${id}`)
      .then((d) => setCertificate(d.certificate))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load certificate.")
      );
  }, [id]);

  const d = certificate?.data;

  return (
    <div>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          main { max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .cert-scroll { overflow: visible !important; }
          .cert-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Screen-only chrome */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <Link
            href="/dashboard/certificates"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-indigo-600"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Certificates
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {certificate
              ? `${certificate.serialNo} · ${CERTIFICATE_TITLES[certificate.type]}`
              : "Certificate"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Prints on one A4 landscape sheet. Turn off browser headers and
            footers for a clean edge.
          </p>
        </div>
        <PrintButton />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden"
        >
          {error}
        </div>
      )}

      {!certificate && !error && (
        <div className="mt-6 h-[210mm] w-full max-w-[297mm] animate-pulse rounded-2xl bg-slate-100 print:hidden" />
      )}

      {certificate && d && (
        <div className="cert-scroll mt-6 overflow-x-auto print:mt-0">
          <div
            className="cert-sheet mx-auto flex shrink-0 flex-col bg-white p-[10mm] text-slate-800 shadow-xl shadow-slate-900/10"
            style={{ width: "297mm", height: "210mm", fontFamily: SERIF }}
          >
            {/* Double border */}
            <div className="flex h-full flex-col border-[3px] border-indigo-950 p-[3mm]">
              <div className="flex h-full flex-col items-center border border-amber-500/80 px-[14mm] py-[8mm] text-center">
                {/* Letterhead */}
                <div className="flex flex-col items-center">
                  {d.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.logoUrl}
                      alt=""
                      className="h-[18mm] w-auto object-contain"
                    />
                  ) : null}
                  <p className="mt-2 text-[15pt] font-semibold tracking-[0.18em] text-indigo-950 uppercase">
                    {d.churchName}
                  </p>
                  {d.churchAddress && (
                    <p className="mt-0.5 text-[9.5pt] text-slate-500">
                      {d.churchAddress}
                    </p>
                  )}
                </div>

                {/* Title */}
                <div className="mt-[6mm] flex items-center gap-4">
                  <span className="h-px w-[28mm] bg-amber-500/80" />
                  <h2 className="text-[30pt] leading-none font-semibold tracking-wide text-indigo-950">
                    {CERTIFICATE_TITLES[certificate.type]}
                  </h2>
                  <span className="h-px w-[28mm] bg-amber-500/80" />
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col items-center justify-center">
                  <p className="text-[12pt] italic text-slate-500">
                    This certifies that
                  </p>
                  <p className="mt-[3mm] border-b border-slate-300 px-[10mm] pb-1 text-[26pt] leading-tight font-bold text-indigo-950">
                    {d.personName}
                  </p>
                  <p className="mt-[5mm] max-w-[210mm] text-[14pt] leading-relaxed text-slate-700">
                    {wording(certificate)}
                  </p>
                  {d.verse && (
                    <p className="mt-[5mm] max-w-[190mm] text-[11pt] leading-relaxed italic text-slate-500">
                      “{d.verse}”
                    </p>
                  )}
                  {certificate.type !== "appreciation" && d.remark && (
                    <p className="mt-[3mm] text-[10pt] text-slate-500">{d.remark}</p>
                  )}
                  {d.witnesses && (
                    <p className="mt-[3mm] text-[10pt] text-slate-600">
                      Witnesses: {d.witnesses}
                    </p>
                  )}
                </div>

                {/* Signatures */}
                <div className="flex w-full items-end justify-between px-[10mm]">
                  <div className="w-[70mm] text-center">
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="text-[11pt] font-semibold text-slate-800">
                        {d.officiant || " "}
                      </p>
                      <p className="text-[8.5pt] tracking-[0.16em] text-slate-500 uppercase">
                        Officiant
                      </p>
                    </div>
                  </div>
                  <div className="w-[70mm] text-center">
                    <div className="border-t border-slate-400 pt-1.5">
                      <p className="text-[11pt] font-semibold text-slate-800">
                        {d.pastorName || " "}
                      </p>
                      <p className="text-[8.5pt] tracking-[0.16em] text-slate-500 uppercase">
                        Pastor
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-[5mm] flex w-full items-center justify-between text-[8pt] tracking-[0.12em] text-slate-400 uppercase">
                  <span>Serial no. {certificate.serialNo}</span>
                  <span>Issued {formatCertificateDate(certificate.issuedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
