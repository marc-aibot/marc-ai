import { YargsConfig } from '@bpinternal/yargs-extra'
import * as prompts from 'prompts'
import * as semver from 'semver'
import * as config from '../config'
import * as errors from '../errors'
import * as utils from '../utils'
import { listVersions } from './list-versions'
import { syncVersions } from './sync-versions'

const { logger } = utils.logging

type VersionJump = 'major' | 'minor' | 'patch' | 'none'

const promptJump = async (pkgName: string, pkgVersion: string): Promise<VersionJump> => {
  const { jump: promptedJump } = await prompts.prompt({
    type: 'select',
    name: 'jump',
    message: `Bump ${pkgName} version from ${pkgVersion}`,
    choices: [
      { title: 'Patch', value: 'patch' },
      { title: 'Minor', value: 'minor' },
      { title: 'Major', value: 'major' },
      { title: 'None', value: 'none' },
    ],
  })
  return promptedJump
}

export const bumpVersion = async (pkgName: string, argv: YargsConfig<typeof config.bumpSchema>) => {
  const { dependency, dependents } = utils.pnpm.findReferences(argv.rootDir, pkgName)
  const targetPackages = [dependency, ...dependents]

  const currentVersions = utils.pnpm.versions(targetPackages)
  const targetVersions = { ...currentVersions }

  for (const { path: pkgPath, content } of targetPackages) {
    if (content.private) {
      continue // no need to bump the version of private packages
    }

    const jump = await promptJump(content.name, content.version)
    if (jump === 'none') {
      continue
    }

    const next = semver.inc(content.version, jump)
    if (!next) {
      throw new errors.DepSynkyError(`Invalid version jump: ${jump}`)
    }

    targetVersions[content.name] = next
    utils.pkgjson.update(pkgPath, { version: next })
  }

  listVersions(argv)
  if (argv.sync) {
    logger.info('Syncing versions...')
    syncVersions(argv, { targetVersions })
  }
}
