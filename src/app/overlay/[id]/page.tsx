import Overlay from "@/components/Overlay";

export const metadata = { title: "Overlay · JOLTIDE", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Overlay id={(await params).id} />;
}
