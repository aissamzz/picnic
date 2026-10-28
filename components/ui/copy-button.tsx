"use client";

import { Check, Copy } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "./button";

/** Copies `value`, confirms with a toast and a checkmark. */
export function CopyButton({
  value,
  label,
  copiedLabel,
  iconOnly,
  ...props
}: Omit<ButtonProps, "onClick" | "children"> & { value: string; label: string; copiedLabel: string; iconOnly?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = Object.assign(document.createElement("textarea"), { value });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast(copiedLabel);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button variant="secondary" size={iconOnly ? "icon" : "md"} onClick={copy} aria-label={iconOnly ? label : undefined} {...props}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {!iconOnly && label}
    </Button>
  );
}
