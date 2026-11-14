import { body, create, failure, json, limit, hash } from '@/lib/room';
export async function POST(request: Request) {
  try {
    const input = await body(request);
    const address = await hash(request.headers.get('cf-connecting-ip') || 'local');
    await limit('create:' + new Date().toISOString().slice(0, 13) + ':' + address, 30);
    return json(await create(input), 201);
  } catch (error) { return failure(error); }
}
