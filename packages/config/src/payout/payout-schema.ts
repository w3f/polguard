import Joi from 'joi';
import { notificationSchema } from '../notification-schema';

// Structural only; the resolver enforces that a resolved `signer` exists.
export const operationsSchema = Joi.object({
  payout: Joi.object({
    signer: Joi.string(),
    notifications: notificationSchema,
  }).optional(),
});
