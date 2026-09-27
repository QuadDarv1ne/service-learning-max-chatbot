// Ambient type references that tsconfig does not pick up automatically.
//
// `bun-types` is not published under `@types/`, and tsconfig has no `types`
// array, so TypeScript only auto-includes `node_modules/@types/*`. Without this
// reference, `tsc --noEmit` reports "Cannot find module 'bun:test'" for every
// test file even though `bun test` runs them fine.
/// <reference types="bun-types/test" />
