import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'frontend', 'dist')
const dest = join(root, 'public')

if (!existsSync(join(src, 'index.html'))) {
  console.error('Missing frontend/dist/index.html. Did the Vite build succeed?')
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log(`Copied ${src} -> ${dest}`)
