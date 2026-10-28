import ar from "@/messages/ar.json";
import fr from "@/messages/fr.json";
import { MenuNotFound } from "@/components/menu/menu-not-found";

export default function NotFound() {
  return <MenuNotFound labels={{ fr: fr.menu, ar: ar.menu }} />;
}
