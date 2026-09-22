/**
 * Domain error carrying an HTTP status and a stable, machine-readable code.
 * Everything thrown from services should be an AppError; anything else is
 * treated as an unexpected 500 by the error handler.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
