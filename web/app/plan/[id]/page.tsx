import PlanApp from '@/components/plan-app';
export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) { return <PlanApp id={(await params).id}/>; }
