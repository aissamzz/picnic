"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import * as React from "react";
import { APP_NAME } from "@/lib/config";
import { fmt, type MenuLabels } from "./labels";

type Suggestion = { slug: string; name: string; commune: string | null };

/** 404 for menus, with "did you mean" from a trigram search on names. */
export function MenuNotFound({ labels }: { labels: { fr: MenuLabels; ar: MenuLabels } }) {
  const [lang, setLang] = React.useState<"fr" | "ar">("fr");
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  React.useEffect(() => {
    setLang(document.documentElement.lang === "ar" ? "ar" : "fr");
    const q = decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() ?? "").replace(/-menu$/, "");
    if (q.length < 3) return;
    fetch(`/api/menu-suggest?q=${encodeURIComponent(q)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSuggestions)
      .catch(() => {});
  }, []);
  const l = labels[lang];
  return (
    <main className="menu-root mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <SearchX className="size-12 text-m-muted" aria-hidden />
      <h1 className="text-2xl font-bold">{l.notFoundTitle}</h1>
      <p className="text-m-muted">{l.notFoundBody}</p>
      {suggestions.length > 0 && (
        <div className="w-full">
          <p className="mb-2 font-semibold">{l.didYouMean}</p>
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.slug}>
                <a href={`/${s.slug}`} className="flex min-h-12 flex-col justify-center rounded-lg border border-m-line px-4 text-start">
                  <span className="font-semibold">{s.name}</span>
                  {s.commune && <span className="text-sm text-m-muted">{s.commune}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">
        {fmt(l.backHome, { app: APP_NAME })}
      </Link>
    </main>
  );
}
