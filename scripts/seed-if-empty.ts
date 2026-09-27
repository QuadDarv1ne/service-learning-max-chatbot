// Idempotent seed: fills the database ONLY if it is empty.
// Safe to run on every startup / deployment — never touches existing data.
//
//   bun run seed:if-empty
//
// Unlike `bun run seed` (which wipes everything first), this script checks
// whether the knowledge base already exists and does nothing if it does.

import { PrismaClient } from '@prisma/client'
import { seedDatabase } from './seed'

const db = new PrismaClient()

async function main() {
  const categories = await db.category.count()
  const commands = await db.botCommand.count()

  if (categories > 0 && commands > 0) {
    console.log(
      `✅ Database already seeded (${categories} categories, ${commands} commands) — nothing to do.`,
    )
    return
  }

  if (categories > 0 || commands > 0) {
    // Partial state (e.g. interrupted setup). Do not guess — ask explicitly.
    console.log(
      `⚠️  Database looks partially seeded (${categories} categories, ${commands} commands).\n` +
        `   Skipping to avoid duplicates. Run "bun run seed" for a clean full reset.`,
    )
    return
  }

  console.log('🌱 Database is empty — running initial seed...')
  await seedDatabase(db)

  const totalCats = await db.category.count()
  const totalItems = await db.faqItem.count()
  const totalCmds = await db.botCommand.count()
  console.log(
    `\n✅ Seed complete: ${totalCats} categories, ${totalItems} FAQ items, ${totalCmds} commands`,
  )
}

main()
  .catch((e) => {
    // Never fail the deployment over a seed problem — the app can still start.
    console.error('Seed-if-empty failed:', e)
  })
  .finally(async () => {
    await db.$disconnect()
  })
