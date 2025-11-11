/**
 * Config Validator Module
 *
 * This module is responsible for validating the raw configuration data.
 *
 * This validator ONLY performs validation and does NOT modify the configuration data.
 * It checks the structure and values of the config but does not apply any defaults
 * or transform the data in any way. Data transformation and default application
 * are handled separately in the config processor module.
 *
 * The module also exports the monitor schemas to be used by other modules,
 * such as the AccountSettingsBuilder, to extract field names.
 */
import * as Joi from 'joi';
import {
  Chain,
  MessengerType,
  MonitorType,
  StakingHandlerType,
  IdentityHandlerType,
  BalancesHandlerType,
  GovernanceHandlerType,
  XcmHandlerType,
  AssetsHandlerType,
  IDENTITY_FIELDS,
  CHAIN_TOKENS,
} from '@w3f/monitoring-common';

const decimalStringPattern = /^-?\d*\.?\d*$/;
const decimalStringSchema = Joi.string().pattern(decimalStringPattern).messages({
  'string.pattern.base': 'Invalid decimal format. Expected format: "123.456"',
});

const channelsSchema = Joi.array()
  // Pattern supports only Matrix rooms at the moment.
  .items(Joi.string().pattern(/^![A-Za-z0-9\._\-]+:[A-Za-z0-9\.\-]+$/))
  .min(1)
  .messages({
    'array.min': 'At least one channel is required',
    'string.pattern.base': 'Invalid channel format',
  });

const notificationSchema = Joi.object({
  messengerType: Joi.string().valid(...Object.values(MessengerType)),
  channels: channelsSchema.required(),
  escalationChannels: channelsSchema.optional(),
  escalationTimeoutMs: Joi.number().integer().min(1),
  needsAck: Joi.boolean(),
  repeatFiringMs: Joi.number().integer().min(1),
});

/**
 * Creates a Joi schema for handler configuration
 * @param handlerEnum - The enum containing handler types
 * @param monitorName - The name of the monitor
 * @returns A Joi schema for handler configuration
 */
function createHandlerSchema(handlerEnum: Record<string, string>, monitorName: string) {
  return Joi.array()
    .items(
      Joi.string()
        .valid(...Object.values(handlerEnum))
        .messages({
          'any.only': `Invalid ${monitorName} handler type. Must be one of: ${Object.values(handlerEnum).join(', ')}`,
        }),
    )
    .min(1)
    .optional()
    .messages({
      'array.min': `At least one handler is required for ${monitorName} monitor`,
    });
}

/**
 * Required fields can be provided either in monitor config or account settings,
 * this is validated separately in monitor-specific validation functions.
 *
 * For example:
 * - Staking monitor requires 'commission' in either monitor or account config
 *
 * See validateValidatorMonitor, etc. for these checks.
 */
// TODO: add validation for payee with the enum (Staked, Stash, etc.)
const stakingMonitorSchema = Joi.object({
  commission: Joi.number().min(0).max(100),
  selfStake: decimalStringSchema,
  payee: Joi.string(),
  fromEra: Joi.number().integer().min(0),
  untilEra: Joi.number().integer().min(0),
  handlers: createHandlerSchema(StakingHandlerType, 'Staking'),
  annotations: Joi.object().optional(),
})
  .custom((value, helpers) => {
    if (value.fromEra !== undefined && value.untilEra !== undefined) {
      if (value.fromEra >= value.untilEra) {
        return helpers.error('any.invalid');
      }
    }
    return value;
  }, 'Era bounds validation')
  .messages({
    'any.invalid': 'fromEra must be less than untilEra when both are specified',
  });

const identityMonitorSchema = Joi.object({
  ...Object.fromEntries(IDENTITY_FIELDS.map(field => [field, Joi.string()])),
  handlers: createHandlerSchema(IdentityHandlerType, 'Identity'),
  annotations: Joi.object().optional(),
});

const balancesMonitorSchema = Joi.object({
  threshold: decimalStringSchema,
  handlers: createHandlerSchema(BalancesHandlerType, 'Balances'),
  annotations: Joi.object().optional(),
});

const governanceMonitorSchema = Joi.object({
  handlers: createHandlerSchema(GovernanceHandlerType, 'Governance'),
  annotations: Joi.object().optional(),
});

const xcmMonitorSchema = Joi.object({
  handlers: createHandlerSchema(XcmHandlerType, 'Xcm'),
  annotations: Joi.object().optional(),
});

const assetsMonitorSchema = Joi.object({
  tokens: Joi.array().items(Joi.string()),
  tokenThresholds: Joi.array().items(Joi.array().ordered(Joi.string(), decimalStringSchema).length(2)),
  handlers: createHandlerSchema(AssetsHandlerType, 'Assets'),
  annotations: Joi.object().optional(),
});

/**
 * Map of monitor types to their schemas
 */
export const monitorSchemas = {
  [MonitorType.Staking]: stakingMonitorSchema,
  [MonitorType.Identity]: identityMonitorSchema,
  [MonitorType.Balances]: balancesMonitorSchema,
  [MonitorType.Governance]: governanceMonitorSchema,
  [MonitorType.Xcm]: xcmMonitorSchema,
  [MonitorType.Assets]: assetsMonitorSchema,
};

/**
 * Extracts field names from a Joi schema
 * @param schema - The Joi schema to extract fields from
 * @returns An array of field names
 */
export function extractFieldsFromSchema(schema: Joi.Schema): string[] {
  const description = schema.describe();

  if (description.type === 'object' && description.keys) {
    return Object.keys(description.keys);
  }

  return [];
}

/**
 * Extracts default values from a Joi schema
 * @param schema - The Joi schema to extract defaults from
 * @returns An object containing field names and their default values
 */
export function extractDefaultsFromSchema(schema: Joi.Schema): Record<string, any> {
  const description = schema.describe();
  const defaults: Record<string, any> = {};

  if (description.type === 'object' && description.keys) {
    Object.entries(description.keys).forEach(([key, value]) => {
      // Type assertion for the value object
      const schemaValue = value as any;
      if (schemaValue.flags && schemaValue.flags.default !== undefined) {
        defaults[key] = schemaValue.flags.default;
      }
    });
  }

  return defaults;
}

const monitorSchema = Joi.object({
  name: Joi.string()
    .valid(...Object.values(MonitorType))
    .required()
    .messages({
      'any.only': 'Invalid monitor type',
    }),
  // Annotations field bypasses validation
  annotations: Joi.object().optional(),
}).when('.name', {
  switch: [
    { is: MonitorType.Staking, then: stakingMonitorSchema },
    { is: MonitorType.Identity, then: identityMonitorSchema },
    { is: MonitorType.Balances, then: balancesMonitorSchema },
    { is: MonitorType.Governance, then: governanceMonitorSchema },
    { is: MonitorType.Xcm, then: xcmMonitorSchema },
    { is: MonitorType.Assets, then: assetsMonitorSchema },
  ],
});

const addressPattern = /^(0x[a-fA-F0-9]{64}|[1-9A-HJ-NP-Za-km-z]{47,48})$/;

const accountSchema = Joi.object({
  address: Joi.string().pattern(addressPattern).required().messages({
    'string.pattern.base': 'Invalid address format',
  }),
  name: Joi.string().optional(),
  // Annotations field bypasses validation
  annotations: Joi.object().optional(),
})
  .concat(stakingMonitorSchema)
  .concat(identityMonitorSchema)
  .concat(balancesMonitorSchema)
  .concat(governanceMonitorSchema)
  .concat(xcmMonitorSchema)
  .concat(assetsMonitorSchema);

const defaultsSchema = Joi.object({
  chains: Joi.array()
    .items(Joi.string().valid(...Object.values(Chain)))
    .optional(),
  monitors: Joi.array().items(monitorSchema).optional(),
  notifications: notificationSchema.optional(),
});

const groupSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .min(17)
    .required()
    .messages({
      'string.pattern.base':
        'Group ID must be in slug format (lowercase letters, numbers, and hyphens, starting with a letter)',
      'string.min': 'Group ID must be more than 16 characters long',
    }),
  chains: Joi.array()
    .items(Joi.string().valid(...Object.values(Chain)))
    .optional(),
  monitors: Joi.array().items(monitorSchema).optional(),
  notifications: notificationSchema.optional(),
  accountSet: Joi.string().required().messages({
    'any.required': 'accountSet field is required and must reference an account set name',
  }),
  // Annotations field bypasses validation
  annotations: Joi.object().optional(),
});

const configSchema = Joi.object({
  accountSets: Joi.object()
    .pattern(
      Joi.string(),
      Joi.array().items(accountSchema).min(1).messages({
        'array.min': 'Each account set must contain at least one account',
      }),
    )
    .min(1)
    .required()
    .messages({
      'object.min': 'At least one account set is required',
      'any.required': 'accountSets section is required',
    }),
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

  // Validate that all group IDs are unique
  const groupIds = new Set<string>();
  validatedConfig.groups.forEach((group: any) => {
    if (groupIds.has(group.id)) {
      throw new Error(`Duplicate group ID found: "${group.id}". All group IDs must be unique.`);
    }
    groupIds.add(group.id);

    // Validate that account set reference exists
    const accountSetName = group.accountSet;
    if (!validatedConfig.accountSets[accountSetName]) {
      throw new Error(
        `Group "${group.id}" references account set "${accountSetName}" which does not exist in accountSets section`,
      );
    }

    validateGroup(group, defaults);
  });
}

function validateGroup(group: any, defaults: any): void {
  const requiredProps = [
    { name: 'chains', check: (val: any) => val && val.length > 0 },
    { name: 'monitors', check: (val: any) => val && val.length > 0 },
    { name: 'notifications', check: (val: any) => val !== undefined },
  ];

  requiredProps.forEach(prop => {
    const value = group[prop.name] || defaults[prop.name];
    if (!prop.check(value)) {
      throw new Error(`Group "${group.id}" must have ${prop.name} defined either in the group or in defaults`);
    }
  });

  validateMonitors(group, defaults);
}

function validateMonitors(group: any, defaults: any): void {
  const monitors = group.monitors || defaults.monitors;

  // Validate that each monitor has handlers defined
  monitors.forEach((monitor: any) => {
    if (!monitor.handlers || monitor.handlers.length === 0) {
      throw new Error(`Monitor ${monitor.name} in group "${group.id}" must have at least one handler defined`);
    }

    if (monitor.name === MonitorType.Assets) {
      const chains: Chain[] = group.chains || defaults.chains;
      validateAssetsMonitor(monitor, chains, group.id);
    }
  });
}

function validateAssetsMonitor(monitor: any, chains: Chain[], groupId: string) {
  const { tokens = [], tokenThresholds = [] } = monitor;

  chains.forEach(chain => {
    const supported = Object.keys(CHAIN_TOKENS[chain] || {});

    tokens.forEach((t: string) => {
      if (!supported.includes(t)) {
        throw new Error(
          `Assets monitor in group "${groupId}" references token "${t}" which is not supported on chain "${chain}".`,
        );
      }
    });

    tokenThresholds.forEach(([t]: [string, any]) => {
      if (!supported.includes(t)) {
        throw new Error(
          `Assets monitor in group "${groupId}" has a threshold entry for token "${t}", which is not supported on chain "${chain}".`,
        );
      }
    });
  });
}
