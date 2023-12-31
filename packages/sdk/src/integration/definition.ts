import { mapValues } from 'radash'
import { z } from 'zod'

import { SchemaDefinition, schemaDefinitionToJsonSchema } from './schema'

const nonEmptyDict = <V extends z.ZodTypeAny>(v: V) => {
  const r = z.record(v)
  return {
    min: (n: number) =>
      r.refine((obj) => Object.keys(obj).length >= n, { message: `At least ${n} item(s) must be defined` }),
  }
}

export const schemaSchema = z.object({}).passthrough()

export const configurationDefinitionSchema = z.object({
  schema: schemaSchema,
})

export const eventDefinitionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  schema: schemaSchema,
})

export const actionDefinitionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  input: z.object({
    schema: schemaSchema,
  }),
  output: z.object({
    schema: schemaSchema,
  }),
})

export const messageDefinitionSchema = z.object({
  schema: schemaSchema,
})

export const tagDefinitionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
})

export const channelDefinitionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  messages: nonEmptyDict(messageDefinitionSchema).min(1),
  message: z
    .object({
      tags: z.record(tagDefinitionSchema),
    })
    .partial()
    .optional(),
  conversation: z
    .object({
      tags: z.record(tagDefinitionSchema),
      creation: z.object({
        enabled: z.boolean(),
        requiredTags: z.array(z.string()),
      }),
    })
    .partial()
    .optional(),
})

export const stateDefinitionSchema = z.object({
  type: z.union([z.literal('integration'), z.literal('conversation'), z.literal('user')]),
  schema: schemaSchema,
})

const PUBLIC_VERSION = '0.2.0' as const
const PRIVATE_VERSION = '0.0.1' as const

export const integrationDefinitionSchema = z.object({
  name: z.string(),
  version: z.enum([PRIVATE_VERSION, PUBLIC_VERSION]),
  title: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  readme: z.string().optional(),
  configuration: configurationDefinitionSchema.optional(),
  events: z.record(eventDefinitionSchema).optional(),
  actions: z.record(actionDefinitionSchema).optional(),
  channels: z.record(channelDefinitionSchema).optional(),
  states: z.record(stateDefinitionSchema).optional(),
  user: z
    .object({
      tags: z.record(tagDefinitionSchema),
      creation: z.object({
        enabled: z.boolean(),
        requiredTags: z.array(z.string()),
      }),
    })
    .partial()
    .optional(),
  secrets: z.array(z.string()).optional(),
})

export type ConfigurationDefinition = z.infer<typeof configurationDefinitionSchema>
export type EventDefinition = z.infer<typeof eventDefinitionSchema>
export type ChannelDefinition = z.infer<typeof channelDefinitionSchema>
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>
export type MessageDefinition = z.infer<typeof messageDefinitionSchema>
export type StateDefinition = z.infer<typeof stateDefinitionSchema>

type IntegrationDefinitionInput = z.input<typeof integrationDefinitionSchema>
type IntegrationDefinitionOutput = z.infer<typeof integrationDefinitionSchema>

type AnyZodObject = z.ZodObject<any>
type Merge<A extends object, B extends object> = Omit<A, keyof B> & B
type Cast<T, U> = T extends U ? T : U

type BaseConfig = AnyZodObject
type BaseEvent = Record<string, AnyZodObject>
type BaseAction = Record<string, Record<'input' | 'output', AnyZodObject>>
type BaseChannel = Record<string, Record<string, AnyZodObject>>
type BaseState = Record<string, AnyZodObject>

// TODO: allow any versions
type IntegrationDefinitionVersion =
  | {
      /** Only version 0.2.0 is supported for public integrations yet. This is temporary. */
      version: typeof PUBLIC_VERSION
    }
  | {
      /** Only version 0.0.1 is supported for private integrations yet. This is temporary. */
      version: typeof PRIVATE_VERSION
    }

export type IntegrationDefinitionProps<
  TConfig extends BaseConfig = BaseConfig,
  TEvent extends BaseEvent = BaseEvent,
  TAction extends BaseAction = BaseAction,
  TChannel extends BaseChannel = BaseChannel,
  TState extends BaseState = BaseState
> = Omit<
  IntegrationDefinitionOutput,
  'public' | 'version' | 'configuration' | 'events' | 'actions' | 'channels' | 'states'
> &
  IntegrationDefinitionVersion & {
    configuration?: Merge<ConfigurationDefinition, SchemaDefinition<TConfig>>
    events?: { [K in keyof TEvent]: Merge<EventDefinition, SchemaDefinition<TEvent[K]>> }

    actions?: {
      [K in keyof TAction]: Merge<
        ActionDefinition,
        {
          ['input']: SchemaDefinition<Cast<TAction[K]['input'], AnyZodObject>>
          ['output']: SchemaDefinition<Cast<TAction[K]['output'], AnyZodObject>>
        }
      >
    }

    channels?: {
      [K in keyof TChannel]: Merge<
        ChannelDefinition,
        {
          messages: {
            [L in keyof TChannel[K]]: Merge<MessageDefinition, SchemaDefinition<TChannel[K][L]>>
          }
        }
      >
    }

    states?: {
      [K in keyof TState]: Merge<StateDefinition, SchemaDefinition<TState[K]>>
    }
  }

function formatIntegrationDefinition(
  definition: IntegrationDefinitionProps<BaseConfig, BaseEvent, BaseAction, BaseChannel, BaseState>
): IntegrationDefinitionInput {
  return {
    ...definition,
    configuration: definition.configuration
      ? {
          ...definition.configuration,
          schema: schemaDefinitionToJsonSchema(definition.configuration),
        }
      : undefined,
    events: definition.events
      ? mapValues(definition.events, (event) => ({
          ...event,
          schema: schemaDefinitionToJsonSchema(event),
        }))
      : undefined,
    actions: definition.actions
      ? mapValues(definition.actions, (action) => ({
          ...action,
          input: {
            ...action.input,
            schema: schemaDefinitionToJsonSchema(action.input),
          },
          output: {
            ...action.output,
            schema: schemaDefinitionToJsonSchema(action.output),
          },
        }))
      : undefined,
    channels: definition.channels
      ? mapValues(definition.channels, (channel) => ({
          ...channel,
          messages: mapValues(channel.messages, (message) => ({
            ...message,
            schema: schemaDefinitionToJsonSchema(message),
          })),
        }))
      : undefined,
    states: definition.states
      ? mapValues(definition.states, (state) => ({
          ...state,
          schema: schemaDefinitionToJsonSchema(state),
        }))
      : undefined,
    user: definition.user,
  }
}

export class IntegrationDefinition<
  TConfig extends BaseConfig = BaseConfig,
  TEvent extends BaseEvent = BaseEvent,
  TAction extends BaseAction = BaseAction,
  TChannel extends BaseChannel = BaseChannel,
  TState extends BaseState = BaseState
> {
  public readonly name: IntegrationDefinitionOutput['name']
  public readonly version: IntegrationDefinitionOutput['version']
  public readonly icon: IntegrationDefinitionOutput['icon']
  public readonly readme: IntegrationDefinitionOutput['readme']
  public readonly title: IntegrationDefinitionOutput['title']
  public readonly description: IntegrationDefinitionOutput['description']
  public readonly configuration: IntegrationDefinitionOutput['configuration']
  public readonly events: IntegrationDefinitionOutput['events']
  public readonly actions: IntegrationDefinitionOutput['actions']
  public readonly channels: IntegrationDefinitionOutput['channels']
  public readonly states: IntegrationDefinitionOutput['states']
  public readonly user: IntegrationDefinitionOutput['user']
  public readonly secrets: IntegrationDefinitionOutput['secrets']
  public constructor(props: IntegrationDefinitionProps<TConfig, TEvent, TAction, TChannel, TState>) {
    const integrationDefinitionInput = formatIntegrationDefinition(props)
    const parsed = integrationDefinitionSchema.parse(integrationDefinitionInput)

    const {
      name,
      version,
      icon,
      readme,
      title,
      description,
      configuration,
      events,
      actions,
      channels,
      states,
      user,
      secrets,
    } = parsed
    this.name = name
    this.version = version
    this.icon = icon
    this.readme = readme
    this.title = title
    this.description = description
    this.configuration = configuration
    this.events = events
    this.actions = actions
    this.channels = channels
    this.states = states
    this.user = user
    this.secrets = secrets
  }
}
