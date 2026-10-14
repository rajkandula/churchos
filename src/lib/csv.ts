"use client";

function cell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV in the browser and hand it to the user as a download. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][]
): void {
  const csv =
    "﻿" +
    [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join(
      "\r\n"
    );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
