import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Night } from '../src/digest/types.js';

const nights = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../src/digest/read.js', () => ({
  readNight: (_dir: string, night: string) => nights.get(night) ?? null,
}));

import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'x' };
const get = (path: string) => createApp(config).request(path);

const night: Night = {
  night: '2026-10-28',
  badLines: 2,
  rows: [
    { job: 'alpha', owner: null, runs: 2, retries: 0, lastStatus: 'ok', lastError: null, firstAt: '2026-10-28T01:00:00+01:00', lastAt: '2026-10-28T02:00:00+01:00' },
    { job: 'beta', owner: 'ann', runs: 5, retries: 3, lastStatus: 'fail', lastError: 'boom', firstAt: '2026-10-28T03:00:00+01:00', lastAt: '2026-10-28T04:00:00+01:00' },
    { job: 'gamma', owner: 'bob', runs: 2, retries: 2, lastStatus: 'retry', lastError: null, firstAt: 'a', lastAt: 'b' },
  ],
};

describe('digest page', () => {
  beforeEach(() => nights.clear());

  it('renders rows in order with dashes, warn marks and bad lines', async () => {
    nights.set('2026-10-28', night);
    const res = await get('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html.indexOf('alpha')).toBeLessThan(html.indexOf('beta'));
    expect(html.indexOf('beta')).toBeLessThan(html.indexOf('gamma'));
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('2026-10-28T03:00:00+01:00');
    expect(html).toContain('<td class="warn">3</td>');
    expect(html).toContain('<td class="warn">fail</td>');
    expect(html).not.toContain('<td class="warn">2</td>');
    expect(html).not.toContain('<td class="warn">ok</td>');
    expect(html).toContain('2 lines did not parse');
  });

  it('omits the bad-line note when there are none', async () => {
    nights.set('n', { ...night, badLines: 0 });
    const html = await (await get('/digest/n')).text();
    expect(html).not.toContain('did not parse');
  });

  it('404 for a night with no file', async () => {
    const res = await get('/digest/2000-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('rig');
  });

  it('says nothing ran for an empty night', async () => {
    nights.set('e', { night: 'e', rows: [], badLines: 0 });
    const res = await get('/digest/e');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
});
