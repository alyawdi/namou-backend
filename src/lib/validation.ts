import { z } from 'zod';

/** Positive integer id, accepting string input from route params. */
export const idSchema = z.coerce.number().int().positive();

export const idParams = z.object({ id: idSchema });
