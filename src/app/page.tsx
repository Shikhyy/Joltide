import Home from "@/components/Home";
import { listCards } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export default async function Page() {
  return <Home live={await listCards()} />;
}
