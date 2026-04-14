import { z } from 'zod';

/** Standard success wrapper */
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

/** Standard error response */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/** Paginated list wrapper */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    pagination: z.object({
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      per_page: z.number().int().positive(),
      total_pages: z.number().int().nonnegative(),
    }),
  });

/** Common query params for paginated lists */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
