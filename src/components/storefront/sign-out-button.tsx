"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="surface"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="gap-2"
    >
      <LogOut className="size-4" />
      Выйти
    </Button>
  );
}
