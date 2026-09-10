/** §14 error format: `{ "error": { "code", "message" } }` with a real status code. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse(): Response {
    return Response.json(
      { error: { code: this.code, message: this.message } },
      { status: this.status },
    );
  }
}

/**
 * Wraps a route handler: `ApiError` becomes its envelope, anything else becomes a 500 that says
 * nothing about the failure. The detail is logged server-side instead.
 */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((error: unknown) => {
    if (error instanceof ApiError) return error.toResponse();
    console.error('[saldo] unhandled route error', error);
    return new ApiError(500, 'internal_error', 'Unexpected server error').toResponse();
  });
}
