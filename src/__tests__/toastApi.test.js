import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// useToast() returns an object ({ show, success, error, info, dismiss }),
// not a function. Calling toast("...", "error") throws "toast is not a
// function" — and because it's usually the last line of a handler, the
// database write before it has already happened, so the user sees a crash
// with no idea that their action actually took effect. Found live on the
// Letter Before Action page (21 Sep 2026) and again in park/resume.

const dir = path.join(__dirname, '..', 'components')
const files = fs.readdirSync(dir, { recursive: true })
  .filter((f) => f.endsWith('.jsx'))
  .map((f) => path.join(dir, f))

describe('toast is always called through its object API', () => {
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8')
    if (!src.includes('useToast()')) continue
    it(path.basename(file), () => {
      const bare = src.split('\n')
        .map((l, i) => [i + 1, l])
        .filter(([, l]) => /(^|[^.\w])toast\(/.test(l) && !/useToast\(|function toast\(|const toast/.test(l))
      expect(bare, `bare toast(...) calls at lines ${bare.map(([n]) => n).join(', ')}`).toEqual([])
    })
  }
})
