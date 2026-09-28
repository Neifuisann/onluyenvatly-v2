"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { authCopy } from "@/lib/messages";

/** Password input with a "show password" checkbox (helps on phones). */
export function PasswordInput(
  props: Omit<React.ComponentProps<typeof Input>, "type">,
) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();
  return (
    <>
      <Input {...props} type={visible ? "text" : "password"} />
      <label
        htmlFor={toggleId}
        className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-muted-foreground text-sm"
      >
        <input
          id={toggleId}
          type="checkbox"
          className="size-4 accent-primary"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
        {authCopy.showPassword}
      </label>
    </>
  );
}
