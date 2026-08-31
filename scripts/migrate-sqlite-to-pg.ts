/**
 * Migrasi satu kali: SQLite (data/binpres.db, warisan GAS) → PostgreSQL.
 * Jalankan dari mesin yang bisa mengakses DB_URL: `bun run migrate:sqlite`
 * - id lama dipertahankan (kompatibel dengan createdBy username & URL berkas)
 * - sequence disamakan agar id baru tidak bentrok
 * - aman dijalankan ulang (onConflictDoNothing)
 */
import { Database } from 'bun:sqlite';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { atlit, jadwalLatihan, klub, pelatih, pengurus, prestasi, users } from '../src/db/schema';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => (Number(v) || 0);

const sqlite = new Database('data/binpres.db');
const all = (t: string) => sqlite.query(`SELECT * FROM ${t}`).all() as Record<string, any>[];

let count = 0;
for (const r of all('users')) {
  // hanya user ber-algoritma baru (argon2id); user hash lama didaftarkan ulang lewat panel
  if (s(r.algo) !== 'bun') {
    console.warn(`⚠️  lewati user "${s(r.username)}" (hash lama, daftarkan ulang lewat panel admin)`);
    continue;
  }
  await db
    .insert(users)
    .values({
      id: n(r.id), nama: s(r.nama), username: s(r.username), passwordHash: s(r.password_hash),
      cabor: s(r.cabor), role: s(r.role) || 'Operator', createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ users: ${count}`);

count = 0;
for (const r of all('atlit')) {
  await db
    .insert(atlit)
    .values({
      id: n(r.id), nama: s(r.nama), tempatLahir: s(r.tempat_lahir), tanggalLahir: s(r.tanggal_lahir),
      jenisKelamin: s(r.jenis_kelamin), alamat: s(r.alamat), kk: s(r.kk), akte: s(r.akte), ktp: s(r.ktp),
      cabor: s(r.cabor), proyeksiPorprov: s(r.proyeksi_porprov) || 'Tidak',
      createdBy: s(r.created_by), createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ atlit: ${count}`);

count = 0;
for (const r of all('prestasi')) {
  await db
    .insert(prestasi)
    .values({
      id: n(r.id), atlitId: n(r.atlit_id), nama: s(r.nama), tahun: n(r.tahun),
      tingkat: s(r.tingkat), piagam: s(r.piagam),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ prestasi: ${count}`);

count = 0;
for (const r of all('pelatih')) {
  await db
    .insert(pelatih)
    .values({
      id: n(r.id), nama: s(r.nama), alamat: s(r.alamat), jenisKelamin: s(r.jenis_kelamin),
      lisensi: s(r.lisensi), fileLisensi: s(r.file_lisensi), cabor: s(r.cabor),
      createdBy: s(r.created_by), createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ pelatih: ${count}`);

count = 0;
for (const r of all('jadwal_latihan')) {
  await db
    .insert(jadwalLatihan)
    .values({
      id: n(r.id), tempat: s(r.tempat), hari: s(r.hari), jam: s(r.jam), cabor: s(r.cabor),
      createdBy: s(r.created_by), createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ jadwal_latihan: ${count}`);

count = 0;
for (const r of all('klub')) {
  await db
    .insert(klub)
    .values({
      id: n(r.id), nama: s(r.nama), cabang: s(r.cabang), alamat: s(r.alamat),
      createdBy: s(r.created_by), createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ klub: ${count}`);

count = 0;
for (const r of all('pengurus')) {
  await db
    .insert(pengurus)
    .values({
      id: n(r.id), nama: s(r.nama), jabatan: s(r.jabatan), bio: s(r.bio), foto: s(r.foto),
      createdAt: n(r.created_at),
    })
    .onConflictDoNothing();
  count++;
}
console.log(`✅ pengurus: ${count}`);

// samakan sequence agar id berikutnya tidak bentrok dengan id yang dimigrasi
for (const t of ['users', 'atlit', 'prestasi', 'pelatih', 'jadwal_latihan', 'klub', 'pengurus']) {
  await db.execute(
    // argumen pertama harus string literal (param), bukan identifier
    sql`SELECT setval(pg_get_serial_sequence(${t}, 'id'), COALESCE((SELECT MAX(id) FROM ${sql.identifier(t)}), 1))`,
  );
}

console.log('🎉 Migrasi SQLite → PostgreSQL selesai.');
process.exit(0);
