import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from './errors';
import { readJson } from './json';

const schema = z.object({ name: z.string().min(1) });

function post(body: string): Request {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
  });
}

describe('readJson', () => {
  it('parses and validates', async () => {
    await expect(readJson(post('{"name":"Ada"}'), schema)).resolves.toEqual({ name: 'Ada' });
  });

  it('rejects malformed json with invalid_json', async () => {
    await expect(readJson(post('{'), schema)).rejects.toMatchObject({
      code: 'invalid_json',
      status: 400,
    });
  });

  it('rejects a body that fails the schema with invalid_body', async () => {
    await expect(readJson(post('{"name":""}'), schema)).rejects.toMatchObject({
      code: 'invalid_body',
      status: 400,
    });
  });

  it('rejects a body over the cap without parsing it', async () => {
    const big = JSON.stringify({ name: 'x'.repeat(200) });
    await expect(readJson(post(big), schema, 64)).rejects.toMatchObject({
      code: 'payload_too_large',
      status: 413,
    });
  });
});

describe('ApiError', () => {
  it('serialises to the documented envelope', async () => {
    const response = new ApiError(404, 'not_found', 'Nope').toResponse();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'not_found', message: 'Nope' },
    });
  });
});
