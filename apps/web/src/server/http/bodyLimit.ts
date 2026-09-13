import { ApiError } from './errors';

/**
 * Refuses a request by its declared size, before anything reads the stream. This is the bound: a
 * `Content-Length` over `maxBytes` is a 413 on the spot, so the server never buffers more than the
 * cap just to find out it should have refused.
 *
 * A missing or non-numeric header is not trusted either way — this function does nothing for one,
 * and whoever calls it must still measure the bytes actually read as a backstop. That backstop is
 * what catches a header that under-reports, or a client (HTTP/2, chunked transfer) that sends none.
 */
export function rejectByContentLength(request: Request, maxBytes: number): void {
  const declared = request.headers.get('content-length');
  if (declared === null) return;
  const size = Number(declared);
  if (Number.isFinite(size) && size > maxBytes) {
    throw new ApiError(413, 'payload_too_large', `Body must be at most ${maxBytes} bytes`);
  }
}
