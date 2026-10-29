import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('status board', () => {
  it('shows the lane banner and the nights on disk', async () => {
    process.env.LANE_MARKER = 'TEST-MARKER';
    const res = await createApp(config).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('2026-10-28');
  });

  it('health answers with the lane id', async () => {
    const res = await createApp(config).request('/health');
    expect(await res.json()).toEqual({ ok: true, lane: 'lane-07' });
  });
});

describe('status board digest links', () => {
  it('links each night to its digest with counts by last status and bad lines', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const line = (job: string, status: string) => JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status, owner: 'x' });
    writeFileSync(
      join(dir, '2026-10-28.jsonl'),
      [line('a', 'ok'), line('b', 'ok'), line('c', 'retry'), line('d', 'fail'), 'not json'].join('\n') + '\n',
    );
    writeFileSync(join(dir, '2026-10-27.jsonl'), line('a', 'ok') + '\n');
    const res = await createApp({ ...config, runsDir: dir }).request('/');
    const html = await res.text();
    expect(html).toContain('<a href="/digest/2026-10-28">2026-10-28</a>');
    expect(html).toContain('2 ok · 1 retry · 1 fail');
    expect(html).toContain('1 bad line');
    expect(html).toContain('<a href="/digest/2026-10-27">2026-10-27</a>');
    expect(html).toContain('1 ok · 0 retry · 0 fail');
  });
});
