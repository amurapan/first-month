import { authorize, failure, json, mutate, view } from '@/lib/room';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; const { row, room, role } = await authorize(request, id); return json(view(row, room, role)); } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { return json(await mutate(request, (await context.params).id)); } catch (error) { return failure(error); }
}
