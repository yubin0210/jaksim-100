import { beforeEach, expect, it, vi } from 'vitest';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { GET } from '@/app/api/checkins/[id]/photo/route';

vi.mock('@/lib/supabase/server');
const request = new Request('http://localhost/api/checkins/chk-1/photo');
const params = { params: Promise.resolve({ id: 'chk-1' }) };
const download = vi.fn();
const maybeSingle = vi.fn();
const filter = { eq: () => filter, maybeSingle };
const getUser = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: { getUser },
    from: () => ({ select: () => filter }),
    storage: { from: () => ({ download }) },
  } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);
});

it('requires a session before reading a photo', async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  expect((await GET(request, params)).status).toBe(401);
  expect(download).not.toHaveBeenCalled();
});

it.each([
  'https://old.example/storage/v1/object/public/checkins/u/r/chk-1.jpg',
  'u/r/chk-1.jpg',
])('serves an existing check-in from its bucket path for %s', async (image) => {
  getUser.mockResolvedValue({ data: { user: { id: 'viewer' } } });
  maybeSingle.mockResolvedValue({
    data: { user_id: 'u', room_id: 'r', image_data: image },
  });
  download.mockResolvedValue({
    data: new Blob(['test'], { type: 'image/jpeg' }),
  });
  const res = await GET(request, params);
  expect(download).toHaveBeenCalledWith('u/r/chk-1.jpg');
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toContain('private');
});
