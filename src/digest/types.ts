// Plan morning-digest § 1. The contract every part of § 2 builds against: the reader fills it,
// the page, the JSON and the board only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job's night, folded from all its lines in runs/<night>.jsonl.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null here; views show it as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // `error` of the last line that had one, else null
  firstAt: string; // `at` as written in the log, offset kept
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; the page and the JSON keep this order
  badLines: number; // lines that did not parse; counted, never thrown
};

// Returns null when runs/<night>.jsonl does not exist (or `night` is not YYYY-MM-DD): a 404.
// An empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
