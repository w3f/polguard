/**
 * Config Validator Module
 *
 * This module is responsible for validating the raw configuration data.
 *
 * This validator ONLY performs validation and does NOT modify the configuration data.
 * It checks the structure and values of the config but does not apply any defaults
 * or transform the data in any way. Data transformation and default application
 * are handled separately in the config processor module.
 */
import * as Joi from 'joi';
import { Chain, ComparisonType, MessengerType, MonitorType } from '@w3f/monitoring-types';

const alertSchema = Joi.object({
  messengerType: Joi.string().valid(...Object.values(MessengerType)),
  targets: Joi.array()
    // Pattern supports only Matrix rooms at the moment.
    .items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one target is required',
      'string.pattern.base': 'Invalid target format',
    })
    .required(),
  acknowledgement: Joi.boolean(),
  repeatIntervalHours: Joi.number(),
});

const validatorMonitorSchema = Joi.object({
  commission: Joi.number().min(0).max(100),
  commissionComparison: Joi.string().valid(...Object.values(ComparisonType)),
  payee: Joi.string(),
});

const balanceThresholdMonitorSchema = Joi.object({
  balanceThreshold: Joi.number(),
});

const monitorSchema = Joi.object({
  name: Joi.string()
    .valid(...Object.values(MonitorType))
    .required()
    .messages({
      'any.only': 'Invalid monitor type',
    }),
})
  .when('.name', {
    switch: [{ is: MonitorType.Validator, then: validatorMonitorSchema }],
  })
  .when('.name', {
    switch: [{ is: MonitorType.BalanceThreshold, then: balanceThresholdMonitorSchema }],
  });

const addressPattern = /^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{47,48})$/;

const accountSchema = Joi.object({
  address: Joi.string().pattern(addressPattern).required().messages({
    'string.pattern.base': 'Invalid address format',
  }),
  name: Joi.string().optional(),
})
  .concat(validatorMonitorSchema)
  .concat(balanceThresholdMonitorSchema);

const defaultsSchema = Joi.object({
  chains: Joi.array()
    .items(Joi.string().valid(...Object.values(Chain)))
    .optional(),
  monitors: Joi.array().items(monitorSchema).optional(),
  alerts: alertSchema.optional(),
});

const groupSchema = Joi.object({
  name: Joi.string().required(),
  chains: Joi.array()
    .items(Joi.string().valid(...Object.values(Chain)))
    .optional(),
  monitors: Joi.array().items(monitorSchema).optional(),
  alerts: alertSchema.optional(),
  accounts: Joi.array().items(accountSchema).min(1).required().messages({
    'array.min': 'At least one account is required in a group',
  }),
});

const configSchema = Joi.object({
  defaults: defaultsSchema.optional(),
  groups: Joi.array().items(groupSchema).min(1).required().messages({
    'array.min': 'At least one group is required in the configuration',
  }),
});

export function validateConfig(config: any): void {
  const { error: configError, value: validatedConfig } = configSchema.validate(config, {
    abortEarly: false,
  });

  if (configError) {
    throw new Error(`Configuration validation failed: ${configError.message}`);
  }

  const defaults = validatedConfig.defaults || {};

  validatedConfig.groups.forEach((group: any) => {
    validateGroup(group, defaults);
  });
}

function validateGroup(group: any, defaults: any): void {
  const requiredProps = [
    { name: 'chains', check: (val: any) => val && val.length > 0 },
    { name: 'monitors', check: (val: any) => val && val.length > 0 },
    { name: 'alerts', check: (val: any) => val !== undefined },
  ];

  requiredProps.forEach(prop => {
    const value = group[prop.name] || defaults[prop.name];
    if (!prop.check(value)) {
      throw new Error(`Group "${group.name}" must have ${prop.name} defined either in the group or in defaults`);
    }
  });

  validateValidatorMonitor(group, defaults);
}

function validateValidatorMonitor(group: any, defaults: any): void {
  const monitors = group.monitors || defaults.monitors;
  const hasValidatorMonitor = monitors.some((monitor: any) => monitor.name === MonitorType.Validator);
  if (hasValidatorMonitor) {
    const validatorMonitor = monitors.find((monitor: any) => monitor.name === MonitorType.Validator);
    group.accounts.forEach((account: any) => {
      if (account.commission === undefined && validatorMonitor.commission === undefined) {
        throw new Error(
          `Neither the Validator monitor nor account ${account.name || account.address} ` +
            `in group ${group.name} has a commission specified`,
        );
      }
    });
  }
}
