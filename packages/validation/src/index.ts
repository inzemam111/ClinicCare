import { z } from 'zod';

export const environmentSchema = z.object({
  API_URL: z.string().url().optional(),
});
