// Unit tests for constant-time secret comparison. Run with: bun test

import { describe, it, expect } from 'bun:test'
import { safeCompare } from './secret-compare'

describe('safeCompare', () => {
  it('accepts identical strings', () => {
    expect(safeCompare('s3cret-value', 's3cret-value')).toBe(true)
  })

  it('rejects different strings of the same length', () => {
    expect(safeCompare('aaaaaaaaaaaa', 'aaaaaaaaaaab')).toBe(false)
  })

  it('rejects strings of different length without throwing', () => {
    // Raw timingSafeEqual throws on length mismatch — hashing must prevent that.
    expect(safeCompare('short', 'much-longer-secret-value')).toBe(false)
    expect(safeCompare('', 'x')).toBe(false)
  })

  it('treats two empty strings as equal', () => {
    expect(safeCompare('', '')).toBe(true)
  })

  it('handles non-ASCII secrets', () => {
    expect(safeCompare('секрет', 'секрет')).toBe(true)
    expect(safeCompare('секрет', 'секрёт')).toBe(false)
  })
})
