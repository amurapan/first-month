import SpaceApp from "@/components/space-app";
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SpaceApp id={(await params).id} />;
}
