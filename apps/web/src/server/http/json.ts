import type { z } from 'zod';
import { ApiError } from './errors';

/** 64 KB is far more than any auth body needs; sync raises its own cap in phase 07. */
const DEFAULT_MAX_BYTES = 64 * 1024;

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<T> {
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) {
    throw new ApiError(413, 'payload_too_large', `Body must be at most ${maxBytes} bytes`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'Body is not valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new ApiError(400, 'invalid_body', detail);
  }
  return parsed.data;
}
