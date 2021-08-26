// Module imports
import { promises as fs } from 'fs'
import merge from 'lodash-es/merge.js'
import path from 'path'





// Constants
const DATA_PATH = path.resolve(process.cwd(), 'data')





async function getFilePaths(type, options) {
  const {
    basePath,
    patchVersion,
  } = options
  const BATTLE_ITEMS_PATH = path.resolve(basePath, type)

  try {
    const DIRECTORY_CONTENTS = await fs.readdir(BATTLE_ITEMS_PATH)
    return DIRECTORY_CONTENTS.reduce((accumulator, item) => {
      const ITEM_ID = item.replace(/\.json$/, '')
      const ITEM_PATH = path
        .resolve(basePath, type, item)
        .replace(new RegExp(`^${process.cwd()}/data/`), '')
        .replace(new RegExp(`${patchVersion}/`), '{version}/')

      accumulator[ITEM_ID] = ITEM_PATH

      return accumulator
    }, {})
  } catch(error) {
    return {}
  }
}

async function compileDataForPatch(patchVersion, manifestObject) {
  const PATCH_DATA_PATH = path.resolve(DATA_PATH, patchVersion)

  const DEFAULT_OPTIONS = {
    basePath: PATCH_DATA_PATH,
    patchVersion,
  }

  const [
    battleItems,
    heldItems,
    pokemon,
    skills,
  ] = await Promise.all([
    getFilePaths('battle-items', DEFAULT_OPTIONS),
    getFilePaths('held-items', DEFAULT_OPTIONS),
    getFilePaths('pokemon', DEFAULT_OPTIONS),
    getFilePaths('skills', DEFAULT_OPTIONS),
  ])

  merge(manifestObject, {
    data: {
      battleItems,
      heldItems,
      pokemon,
      skills,
    },
  })
}

async function generateManifest() {
  const MANIFEST_OBJECT = {
    data: {
      battleItems: {},
      heldItems: {},
      pokemon: {},
      skills: {},
    },
    patches: {},
  }

  // Get all patches
  const PATCHES = await fs.readdir(DATA_PATH)

  MANIFEST_OBJECT.patches = PATCHES.filter(item => /^(?:\d+\.)+\d$/.test(item))

  // Compile base data
  compileDataForPatch('base', MANIFEST_OBJECT)

  // Loop through patches to compile all other data
  for (let index = 0; index < PATCHES.length; index += 1) {
    await compileDataForPatch(PATCHES[index], MANIFEST_OBJECT)
  }

  const MANIFEST_JSON_PATH = path.resolve(process.cwd(), 'manifest.json')
  const MANIFEST_JSON_STRING = JSON.stringify(MANIFEST_OBJECT, null, 2)
  await fs.writeFile(MANIFEST_JSON_PATH, MANIFEST_JSON_STRING, 'utf8')
}

generateManifest()
