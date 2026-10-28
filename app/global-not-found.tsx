import Link from "next/link";
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = { title: `404 · ${APP_NAME}` };

/** Unmatched URLs outside the site and menu layouts. */
export default function GlobalNotFound() {
  return (
    <html lang="fr" className="menu-doc">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="text-muted">Page introuvable · الصفحة غير موجودة</p>
          <Link href="/" className="font-semibold text-primary underline underline-offset-4">
            {APP_NAME}
          </Link>
        </main>
      </body>
    </html>
  );
}
