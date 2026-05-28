import { http, HttpResponse } from 'msw';

export interface CapturedRequest {
  url: string;
  body: unknown;
}

export interface CapturedUpload {
  url: string;
  token: FormDataEntryValue | null;
  force: FormDataEntryValue | null;
  name: FormDataEntryValue | null;
}

export const capturedRequests: CapturedRequest[] = [];
export const capturedUploads: CapturedUpload[] = [];

export const handlers = [
  http.post('https://dc.hhhl.cc/api/chat/rooms/show', async ({ request }) => {
    const body = await request.json();
    capturedRequests.push({ url: request.url, body });

    return HttpResponse.json({ id: 'abc', name: 'Room ABC' });
  }),
  http.post('https://dc.hhhl.cc/api/fail', async ({ request }) => {
    const body = await request.json();
    capturedRequests.push({ url: request.url, body });

    return HttpResponse.json({ error: { code: 'FAILED', message: 'token=secret-token' } }, { status: 403 });
  }),
  http.post('https://dc.hhhl.cc/api/slow', () => new Promise(() => undefined)),
  http.post('https://dc.hhhl.cc/api/drive/files/create', async ({ request }) => {
    const formData = await request.formData();

    capturedUploads.push({
      url: request.url,
      token: formData.get('i'),
      force: formData.get('force'),
      name: formData.get('name'),
    });

    return HttpResponse.json({ id: 'file-1', name: 'hello.txt' });
  }),
];
