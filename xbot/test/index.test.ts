import worker from '../src/index';

describe('xbot worker', () => {
  it('returns health status', async () => {
    const response = await worker.fetch(new Request('https://xbot.example.com/health'), {}, {} as ExecutionContext);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'xbot' });
  });
});
