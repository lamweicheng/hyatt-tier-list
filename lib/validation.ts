import { z } from 'zod';
import { PILLARS } from './constants';

// Phase 1 (internal id 0): instance initialization and key due dates
export const phase0Schema = z.object({
  pillar: z.enum(PILLARS, {
    errorMap: () => ({ message: 'Select a pillar' })
  }),
  emManagerName: z.string().min(1, 'EM Manager name is required').max(120, 'Max 120 characters'),
  emManagerEmail: z
    .string()
    .email('Enter a valid email')
    .max(160, 'Max 160 characters')
    .optional()
    .or(z.literal('')),
  gspPlannerName: z.string().min(1, 'GSP Planner name is required').max(120, 'Max 120 characters'),
  gspPlannerEmail: z
    .string()
    .email('Enter a valid email')
    .max(160, 'Max 160 characters')
    .optional()
    .or(z.literal('')),
  tpmName: z
    .string()
    .max(120, 'Max 120 characters')
    .optional()
    .or(z.literal('')),
  tpmEmail: z
    .string()
    .email('Enter a valid TPM email')
    .max(160, 'Max 160 characters')
    .optional()
    .or(z.literal('')),
  // Dates are provided as YYYY-MM-DD strings from the UI and parsed on the server
  duePreparation: z.string().min(1, 'Preparation due (assignee forecast) is required'),
  dueReview: z.string().min(1, 'Review due (approver review) is required'),
  dueSubmission: z.string().min(1, 'Submission due (send forecast to TPM) is required')
});

export type Phase0Payload = z.infer<typeof phase0Schema>;