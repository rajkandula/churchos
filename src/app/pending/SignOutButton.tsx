"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
