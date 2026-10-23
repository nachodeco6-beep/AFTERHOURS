/**
 * Publishes dist/ to the gh-pages branch, which GitHub Pages serves at
 * https://<user>.github.io/<repo>/.
 *
 *   npm run deploy      (builds with --base=/AFTERHOURS/ first)
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ is missing — run the build first')

const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()
const remote = git(['remote', 'get-url', 'origin'], ROOT)
const source = git(['rev-parse', '--short', 'HEAD'], ROOT)

const tmp = mkdtempSync(join(tmpdir(), 'afterhours-pages-'))
try {
  cpSync(DIST, tmp, { recursive: true })
  writeFileSync(join(tmp, '.nojekyll'), '') // serve files as-is, no Jekyll processing
  git(['init', '-q', '-b', 'gh-pages'], tmp)
  git(['add', '-A'], tmp)
  git(['commit', '-q', '-m', `Deploy ${source}`], tmp)
  git(['push', '-q', '--force', remote, 'gh-pages'], tmp)
  console.log(`✓ Published ${source} to gh-pages`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
