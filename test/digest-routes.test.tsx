import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Real reader, real files: the routes run against a temp runs dir.
let dir: string;

const line = (at: string, job: string, status: string, owner: string | null, extra: object = {}) =>
  JSON.stringify({ at, job, status, owner, ...extra });

const GOOD = [
  line('2026-10-28T23:00:02+01:00', 'b/job', 'ok', 'lane-07'),
  line('2026-10-28T23:05:10+01:00', 'a/job', 'retry', null, { error: 'timeout' }),
  line('2026-10-28T23:09:44+01:00', 'a/job', 'ok', 'lane-07'),
  line('2026-10-28T23:12:00+01:00', 'c/job', 'fail', 'lane-03', { error: 'exit 2' }),
];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
  writeFileSync(join(dir, '2026-10-28.jsonl'), GOOD.join('\n') + '\n');
  writeFileSync(join(dir, '2026-10-27.jsonl'), '');
  writeFileSync(join(dir, '2026-10-26.jsonl'), [GOOD[0], 'this is not json', GOOD[1]].join('\n') + '\n');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const app = () =>
  createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });

describe('GET /digest/:night', () => {
  it('200 and shows the job names in reader order', async () => {
    const res = await app().request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const html = await res.text();
    const at = ['a/job', 'b/job', 'c/job'].map((j) => html.indexOf(j));
    expect(at.every((i) => i > -1)).toBe(true);
    expect(at[0]).toBeLessThan(at[1] as number);
    expect(at[1]).toBeLessThan(at[2] as number);
  });

  it('404 for a night with no file', async () => {
    const res = await app().request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('empty night: 200 and says nothing ran', async () => {
    const res = await app().request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('bad line: still 200, good rows still shown', async () => {
    const res = await app().request('/digest/2026-10-26');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('b/job');
    expect(html).toContain('a/job');
    expect(html).toContain('1 line did not parse');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with rows in the same order as the page', async () => {
    const res = await app().request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: { job: string }[]; badLines: number };
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job', 'c/job']);
    const html = await (await app().request('/digest/2026-10-28')).text();
    const pageOrder = body.rows.map((r) => html.indexOf(r.job));
    expect(pageOrder).toEqual([...pageOrder].sort((x, y) => x - y));
  });

  it('404 with a JSON error for a night with no file', async () => {
    const res = await app().request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night' });
  });

  it('empty night: 200 with rows []', async () => {
    const res = await app().request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-27', rows: [], badLines: 0 });
  });

  it('bad line: 200, badLines is 1, good rows kept', async () => {
    const res = await app().request('/api/digest/2026-10-26');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });
});
