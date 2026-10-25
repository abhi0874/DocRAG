import { readFileSync } from 'node:fs'
import { chunkPages } from '../lib/chunking'
const input = JSON.parse(readFileSync(0, 'utf8'))
process.stdout.write(JSON.stringify(chunkPages(input.pages, input.config, input.sourceIds)))
