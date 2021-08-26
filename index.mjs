import { filename } from 'dirname-filename-esm'
import path from 'path'

const __filename = filename(import.meta)

export const DATA_ROOT = path.resolve(path.dirname(__filename), 'data')
