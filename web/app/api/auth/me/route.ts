import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/handler';

export const GET = handle(async (req: NextRequest) => {
  return await getCurrentUser(req);
});
