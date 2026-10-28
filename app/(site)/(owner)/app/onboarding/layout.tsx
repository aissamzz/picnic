import { Logo } from "@/components/brand/logo";
import { LanguagePicker } from "@/components/ui/language-picker";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-4 pt-4">
        <Logo />
        <LanguagePicker />
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-4 pb-10">{children}</main>
    </div>
  );
}
