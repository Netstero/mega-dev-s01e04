import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies RunStatus[];

const isStatus = (v: unknown): v is RunStatus => typeof v === 'string' && STATUSES.includes(v);

// Parse one log line at the edge. null when it does not parse or lacks a required field.
function parseLine(text: string): Line | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { at, job, status, owner, error } = v as Record<string, unknown>;
  if (typeof at !== 'string' || typeof job !== 'string' || !isStatus(status)) return null;
  if (owner !== null && typeof owner !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;
  return { at, job, status, owner, error: error ?? null };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const file = join(runsDir, `${night}.jsonl`);
  if (!existsSync(file)) return null;

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (!line) {
      badLines++;
      continue;
    }
    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.owner = line.owner;
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.error !== null) row.lastError = line.error;
    row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
