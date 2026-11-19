import MarketClient from "@/components/MarketClient";
import { listCards } from "@/lib/runtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Store · JOLTIDE", description: "Play live experiences, start from a template, or remix a community creation." };

export default async function Page() {
  return <MarketClient live={await listCards()} />;
}
