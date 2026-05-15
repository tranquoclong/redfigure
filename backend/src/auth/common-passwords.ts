import { readFileSync } from 'fs';
import { join } from 'path';

function loadCommonPasswords(): Set<string> {
  const path = join(__dirname, 'common-passwords.txt');
  const content = readFileSync(path, 'utf-8');
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
  return new Set(entries);
}

export const COMMON_PASSWORDS: ReadonlySet<string> = loadCommonPasswords();
