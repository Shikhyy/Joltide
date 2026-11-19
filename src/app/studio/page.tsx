import { Suspense } from "react";
import StudioClient from "@/components/StudioClient";

export default function Page() {
  return (
    <Suspense>
      <StudioClient />
    </Suspense>
  );
}
