import * as Joi from 'joi';
import { Chain, MonitorType } from '../constants';

const alertSchema = Joi.object({
  matrix: Joi.object({
    rooms: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required(),
    escalation: Joi.object({
      timeout: Joi.number().required(),
      rooms: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required()
    }).optional()
  }).required()
});

const validatorSettingsSchema = Joi.object({
  commission: Joi.number().min(0).max(100).optional(),
  payee: Joi.string().optional()
});

const governanceSettingsSchema = Joi.object({
  // TODO: governance-specific validation here
});

const transactionSettingsSchema = Joi.object({
  // TODO: transaction-specific validation here
});

const monitorConfigSchema = Joi.object({
  name: Joi.string().valid(...Object.values(MonitorType)).required(),
  settings: Joi.alternatives().conditional('name', {
    switch: [
      { is: MonitorType.Validator, then: validatorSettingsSchema },
      { is: MonitorType.Governance, then: governanceSettingsSchema },
      { is: MonitorType.Transaction, then: transactionSettingsSchema },
    ]
  }).required()
});

const accountSchema = Joi.object({
  name: Joi.string().optional(),
  address: Joi.string().pattern(/^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{47,48})$/).required(),
  [MonitorType.Validator]: validatorSettingsSchema.optional(),
  [MonitorType.Governance]: governanceSettingsSchema.optional(),
  [MonitorType.Transaction]: transactionSettingsSchema.optional()
});

const groupSchema = Joi.object({
  name: Joi.string().required(),
  chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).optional(),
  monitors: Joi.array().items(monitorConfigSchema).optional(),
  accounts: Joi.array().items(accountSchema).min(1).required(),
  alerts: alertSchema.optional()
});

export const configSchema = Joi.object({
  version: Joi.string().required(),
  defaults: Joi.object({
    chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).min(1).required(),
    monitors: Joi.array().items(monitorConfigSchema).min(1).required(),
    alerts: alertSchema.required()
  }).required(),
  groups: Joi.array().items(groupSchema).min(1).required()
});

export function validateConfig(config: any): void {
  const { error } = configSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(`Configuration validation failed: ${error.message}`);
  }

  // Cross-field validations
  config.groups.forEach((group: any) => {
    validateGroup(group);
  });
}

export function validateGroup(group: any): void {
  const hasValidatorMonitor = group.monitors.some((monitor: any) => monitor.name === MonitorType.Validator);

  if (hasValidatorMonitor) {
    group.accounts.forEach((account: any) => {
      if (!account[MonitorType.Validator] || account[MonitorType.Validator].commission === undefined) {
        throw new Error(`Account ${account.name || account.address} in group ${group.name} is missing commission for Validator monitor`);
      }
    });
  }

  // TODO: more cross-field validations
}
