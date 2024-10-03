import * as Joi from 'joi';
import { Chain, MonitorType } from '../constants';

const alertSchema = Joi.object({
  matrix: Joi.object({
    targets: Joi.array().items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/)).min(1).required(),
    repeat_interval: Joi.number().optional(),
    acknowledgement: Joi.boolean().default(false).optional()
  }).required()
});


const monitorSettingsSchemas = {
  [MonitorType.Validator]: Joi.object({
    commission: Joi.number().min(0).max(100).optional(),
    payee: Joi.string().optional(),
  }),
  [MonitorType.Governance]: Joi.object({}),
  [MonitorType.TransactionIngress]: Joi.object({}),
  [MonitorType.TransactionEgress]: Joi.object({}),
  [MonitorType.BalanceIncrement]: Joi.object({
    balanceThreshold: Joi.string().pattern(/^\d+$/).optional(),
  }),
  [MonitorType.BalanceDecrement]: Joi.object({
    balanceThreshold: Joi.string().pattern(/^\d+$/).optional(),
  }),
};



const createMonitorConfigSchema = (monitorType: MonitorType) => {
  const baseSchema = {
    name: Joi.string().valid(monitorType).required(),
  };

  if (monitorType === MonitorType.Validator) {
    return Joi.object({
      ...baseSchema,
      commission: Joi.number().min(0).max(100).optional(),
      payee: Joi.string().optional(),
    });
  }

  const monitorSchema = monitorSettingsSchemas[monitorType];
  if (monitorSchema) {
    return Joi.object({
      ...baseSchema,
      ...monitorSchema.describe().keys,
    });
  }

  // For monitor types without specific settings
  return Joi.object(baseSchema);
};


const monitorConfigSchema = Joi.alternatives().try(
  ...Object.values(MonitorType).map(monitorType => createMonitorConfigSchema(monitorType))
);


// Dynamically create the account schema based on monitor settings
const createAccountSchema = (monitors) => {
  const baseSchema = {
    name: Joi.string().optional(),
    address: Joi.string().pattern(/^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{47,48})$/).required(),
  };

  const additionalFields = monitors.reduce((acc, monitor) => {
    if (monitor && monitor.name && monitorSettingsSchemas[monitor.name]) {
      const monitorSchema = monitorSettingsSchemas[monitor.name];
      const schemaKeys = monitorSchema.describe().keys;
      
      Object.keys(schemaKeys).forEach(key => {
        if (!acc[key]) {
          acc[key] = monitorSchema.extract(key);
        }
      });
    }
    return acc;
  }, {});

  const accountSchema = { ...baseSchema, ...additionalFields };

  return Joi.object(accountSchema).strict();
};

const createGroupSchema = (monitors) => Joi.object({
  name: Joi.string().required(),
  chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).optional(),
  monitors: Joi.array().items(monitorConfigSchema).optional(),
  accounts: Joi.array().items(createAccountSchema(monitors)).min(1).required(),
  alerts: alertSchema.optional(),
}).strict();


const configSchema = Joi.object({
  version: Joi.string().required(),
  defaults: Joi.object({
    chains: Joi.array().items(Joi.string().valid(...Object.values(Chain))).min(1).required(),
    monitors: Joi.array().items(monitorConfigSchema).min(1).required(),
    alerts: alertSchema.required()
  }).required(),
  groups: Joi.array().items(Joi.object()).min(1).required()
}).strict();

export function validateConfig(config: any): void {
  const { error: defaultsError } = configSchema.validate(config, { abortEarly: false });
  if (defaultsError) {
    throw new Error(`Configuration validation failed: ${defaultsError.message}`);
  }

  // Validate each group with its specific monitors
  config.groups.forEach((group: any) => {
    const groupSchema = createGroupSchema(group.monitors || config.defaults.monitors);
    const { error: groupError } = groupSchema.validate(group, { abortEarly: false });
    if (groupError) {
      throw new Error(`Group "${group.name}" validation failed: ${groupError.message}`);
    }
  });

  // Cross-field validations
  config.groups.forEach((group: any) => {
    validateGroup(group, config.defaults);
  });
  
}

function validateGroup(group: any, defaults: any): void {
  const monitors = group.monitors || defaults.monitors;
  const hasValidatorMonitor = monitors.some((monitor: any) => monitor.name === MonitorType.Validator);

  if (hasValidatorMonitor) {
    const validatorMonitor = monitors.find((monitor: any) => monitor.name === MonitorType.Validator);
    const monitorCommission = validatorMonitor.commission;

    group.accounts.forEach((account: any) => {
      if (account.commission === undefined && monitorCommission === undefined) {
        throw new Error(`Neither the Validator monitor nor account ${account.name || account.address} in group ${group.name} has a commission specified`);
      }
    });
  }

  // TODO: more cross-field validations
}

