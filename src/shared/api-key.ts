import { timingSafeEqual } from 'node:crypto';

export function secureCompareApiKey(
  provided: string | undefined,
  expected: string
): boolean {
  if (!provided) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
