import Joi from 'joi';
import { MessengerType } from '@w3f/polguard-common';

const channelsSchema = Joi.array()
  // Pattern supports only Matrix rooms at the moment.
  .items(Joi.string().pattern(/^![A-Za-z0-9._-]+:[A-Za-z0-9.-]+$/))
  .min(1)
  .messages({
    'array.min': 'At least one channel is required',
    'string.pattern.base': 'Invalid channel format',
  });

export const notificationSchema = Joi.object({
  messengerType: Joi.string().valid(...Object.values(MessengerType)),
  channels: channelsSchema.required(),
  escalationChannels: channelsSchema.optional(),
  escalationTimeoutMs: Joi.number().integer().min(1),
  needsAck: Joi.boolean(),
  repeatFiringMs: Joi.number().integer().min(1),
});
