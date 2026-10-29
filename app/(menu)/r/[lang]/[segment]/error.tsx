"use client";

// No intl provider on menus (and no message bundle in the client): both languages, inline.
export default function MenuError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">Le menu n&apos;a pas pu s&apos;afficher.</p>
      <p lang="ar" dir="rtl" className="text-lg font-semibold">
        تعذّر عرض القائمة.
      </p>
      <button type="button" onClick={reset} className="min-h-11 rounded-full bg-black px-5 font-semibold text-white">
        Réessayer · إعادة المحاولة
      </button>
    </main>
  );
}
