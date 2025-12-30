/**
 * This file is a compatibility stub for code that references Prisma.
 * The actual application uses Supabase instead of Prisma.
 *
 * If you see imports from this file, they should be refactored to use
 * Supabase client from @/lib/supabase/server instead.
 */

// Stub export to prevent import errors
export const prisma = null

console.warn(
  "[WARNING] This application uses Supabase, not Prisma. " +
    "Please refactor code to use createClient() from @/lib/supabase/server",
)
