import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
const line = (job: string, status: string, at: string, extra: object = {}) =>
  JSON.stringify({ job, owner: 'ann', status, at, ...extra });
writeFileSync(
  join(dir, '2026-10-28.jsonl'),
  [
    line('zeta', 'ok', '2026-10-28T02:00:00+01:00'),
    line('alpha', 'retry', '2026-10-28T02:10:00+01:00', { error: 'boom' }),
    'not json',
    line('alpha', 'ok', '2026-10-28T02:20:00+01:00'),
  ].join('\n') + '\n',
);
writeFileSync(join(dir, '2026-10-27.jsonl'), '');

const app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

describe('GET /api/digest/:night', () => {
  it('returns the night with rows in reader order', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string; runs: number }[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'zeta']);
    expect(body.rows[0]?.runs).toBe(2);
    expect(body.badLines).toBe(1);
  });

  it('404 with a JSON error for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('an empty night has rows []', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-27', rows: [], badLines: 0 });
  });
});
