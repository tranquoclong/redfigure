import { randomBytes } from 'crypto';

export function uuidv7(): string {
  const tsMs = Date.now();
  const rand = randomBytes(10);

  const bytes = Buffer.alloc(16);

  bytes.writeUIntBE(tsMs, 0, 6);

  bytes[6] = 0x70 | (rand[0] & 0x0f);

  bytes[7] = rand[1];

  bytes[8] = 0x80 | (rand[2] & 0x3f);

  rand.copy(bytes, 9, 3, 10);

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
