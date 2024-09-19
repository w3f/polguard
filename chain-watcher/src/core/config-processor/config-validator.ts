import * as Joi from 'joi';
import { Chain, MonitorType } from '../constants';

const monitorSchema = Joi.object({
  name: Joi.string().valid(...Object.values(MonitorType)).required(),
  defaults: Joi.object({
    commission: Joi.number().when('name', {
      is: MonitorType.Validator,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    payee: Joi.string().when('name', {
      is: MonitorType.Validator,
      then: Joi.optional(),
      otherwise: Joi.optional()
    })
  }).optional()
});

const accountSchema = Joi.object({
  name: Joi.string().optional(),
  address: Joi.string().pattern(/^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{47,48})$/).required()
});

const alertSchema = Joi.object({
  matrix: Joi.object({
    rooms: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required(),
    escalation: Joi.object({
      timeout: Joi.number().required(),
      rooms: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required()
    }).optional()
  }).required()
});

const groupSchema = Joi.object({
  name: Joi.string().required(),
  chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).optional(),
  monitors: Joi.array().items(monitorSchema).optional(),
  accounts: Joi.array().items(accountSchema).min(1).required(),
  alerts: alertSchema.optional()
});

export const configSchema = Joi.object({
  version: Joi.string().required(),
  defaults: Joi.object({
    chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).min(1).required(),
    monitors: Joi.array().items(monitorSchema).min(1).required(),
    alerts: alertSchema.required()
  }).required(),
  groups: Joi.array().items(groupSchema).min(1).required()
});

export function validateConfig(config: any): void {
  const { error } = configSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }
}
