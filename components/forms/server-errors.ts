import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/actions/result";

/** Pushes server-side field errors into react-hook-form. Returns the form-level error key. */
export function applyServerErrors<T extends FieldValues>(
  result: { ok: true } | Extract<ActionResult, { ok: false }>,
  setError: UseFormSetError<T>,
): string | null {
  if (result.ok) return null;
  const fields = result.fieldErrors ?? {};
  for (const [name, message] of Object.entries(fields)) setError(name as Path<T>, { type: "server", message });
  // Field-specific errors are shown next to the field; generic ones at the top.
  return Object.keys(fields).length ? null : result.error;
}
