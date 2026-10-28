import { APP_NAME } from "@/lib/config";

// Placeholder until the marketing landing page (phase 3+).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-2 px-4">
      <h1 className="text-3xl font-bold">{APP_NAME}</h1>
    </main>
  );
}
