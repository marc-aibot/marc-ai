import type yargs from '@bpinternal/yargs-extra'
// eslint-disable-next-line no-duplicate-imports
import type { YargsConfig, YargsSchema } from '@bpinternal/yargs-extra'
import type * as utils from './utils'

export type CommandPositionalOption = yargs.PositionalOptions & { positional: true; idx: number }
export type CommandNamedOption = YargsSchema[string] & { positional?: false }
export type CommandOption = CommandPositionalOption | CommandNamedOption
export type CommandSchema = Record<string, CommandOption>

export type CommandArgv<C extends CommandDefinition = CommandDefinition> = YargsConfig<C['schema']> & {
  cliRootDir: utils.path.AbsolutePath
}

export type CommandDefinition<S extends CommandSchema = CommandSchema> = {
  schema: S
  description?: string
  alias?: string
}

export type CommandImplementation<C extends CommandDefinition = CommandDefinition> = (
  argv: CommandArgv<C>
) => Promise<never>

export type CommandLeaf<C extends CommandDefinition = CommandDefinition> = C & {
  handler: CommandImplementation<C>
}
