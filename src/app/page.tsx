import Landing from "@/components/Landing";
import { listCards } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <Landing cards={await listCards()} />;
}
