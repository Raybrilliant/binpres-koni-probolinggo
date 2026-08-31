/**
 * Buat/perbarui akun admin pertama.
 * Jalankan: `bun run admin:create <username> <password>` (password ≥ 6 karakter).
 * Jika username sudah ada → password-nya direset.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db';
import { users } from '../src/db/schema';

const username = process.argv[2] ?? '';
const password = process.argv[3] ?? '';

if (username.length < 3 || password.length < 6) {
  console.error('Pemakaian: bun run admin:create <username> <password>  (password minimal 6 karakter)');
  process.exit(1);
}

const existing = (
  await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
    .limit(1)
)[0];

if (existing) {
  await db
    .update(users)
    .set({ passwordHash: await Bun.password.hash(password), algo: 'bun' })
    .where(eq(users.id, existing.id));
  console.log(`♻️  Password user "${existing.username}" direset.`);
} else {
  await db.insert(users).values({
    nama: 'Admin KONI',
    username,
    passwordHash: await Bun.password.hash(password),
    cabor: 'Semua',
    role: 'Super Admin',
  });
  console.log(`👑 Admin dibuat → username: ${username}`);
}
process.exit(0);
