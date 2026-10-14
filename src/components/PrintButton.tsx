"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Opens the browser print dialog — print or save as PDF. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      Print / Save PDF
    </Button>
  );
}
