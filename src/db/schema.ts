import { doublePrecision, index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const now = () => Date.now();

export const users = pgTable(
  'users',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nama: text('nama').notNull().default(''),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    cabor: text('cabor').notNull().default(''),
    role: text('role').notNull().default('Operator'),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex('users_username_uq').on(t.username)],
);

export const atlit = pgTable(
  'atlit',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nama: text('nama').notNull().default(''),
    tempatLahir: text('tempat_lahir').notNull().default(''),
    tanggalLahir: text('tanggal_lahir').notNull().default(''), // YYYY-MM-DD
    jenisKelamin: text('jenis_kelamin').notNull().default(''),
    alamat: text('alamat').notNull().default(''),
    kk: text('kk').notNull().default(''), // url /uploads/...
    akte: text('akte').notNull().default(''),
    ktp: text('ktp').notNull().default(''),
    foto: text('foto').notNull().default(''), // foto profil setengah badan
    cabor: text('cabor').notNull().default(''),
    proyeksiPorprov: text('proyeksi_porprov').notNull().default('Tidak'),
    createdBy: text('created_by').notNull().default(''),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('atlit_created_by_idx').on(t.createdBy)],
);

export const prestasi = pgTable(
  'prestasi',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    atlitId: integer('atlit_id')
      .notNull()
      .references(() => atlit.id, { onDelete: 'cascade' }),
    nama: text('nama').notNull().default(''),
    tahun: integer('tahun').notNull().default(0),
    tingkat: text('tingkat').notNull().default(''),
    piagam: text('piagam').notNull().default(''),
  },
  (t) => [index('prestasi_atlit_id_idx').on(t.atlitId)],
);

export const pelatih = pgTable(
  'pelatih',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nama: text('nama').notNull().default(''),
    alamat: text('alamat').notNull().default(''),
    jenisKelamin: text('jenis_kelamin').notNull().default(''),
    lisensi: text('lisensi').notNull().default(''),
    fileLisensi: text('file_lisensi').notNull().default(''),
    foto: text('foto').notNull().default(''), // foto profil setengah badan
    cabor: text('cabor').notNull().default(''),
    createdBy: text('created_by').notNull().default(''),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('pelatih_created_by_idx').on(t.createdBy)],
);

export const jadwalLatihan = pgTable(
  'jadwal_latihan',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    tempat: text('tempat').notNull().default(''),
    hari: text('hari').notNull().default(''), // "Senin - Sabtu"
    jam: text('jam').notNull().default(''), // "16:00 - 18:00"
    cabor: text('cabor').notNull().default(''),
    createdBy: text('created_by').notNull().default(''),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('jadwal_created_by_idx').on(t.createdBy)],
);

export const klub = pgTable(
  'klub',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nama: text('nama').notNull().default(''),
    cabang: text('cabang').notNull().default(''),
    alamat: text('alamat').notNull().default(''),
    createdBy: text('created_by').notNull().default(''),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('klub_created_by_idx').on(t.createdBy)],
);

export const medali = pgTable(
  'medali',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    cabor: text('cabor').notNull().default(''),
    periode: text('periode').notNull().default(''), // cth: 2027 (PORPROX tiap 2 tahun)
    targetEmas: integer('target_emas').notNull().default(0),
    targetPerak: integer('target_perak').notNull().default(0),
    targetPerunggu: integer('target_perunggu').notNull().default(0),
    hasilEmas: integer('hasil_emas').notNull().default(0),
    hasilPerak: integer('hasil_perak').notNull().default(0),
    hasilPerunggu: integer('hasil_perunggu').notNull().default(0),
    createdBy: text('created_by').notNull().default(''),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  (t) => [index('medali_created_by_idx').on(t.createdBy)],
);

export const pengurus = pgTable('pengurus', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  nama: text('nama').notNull().default(''),
  jabatan: text('jabatan').notNull().default(''),
  bio: text('bio').notNull().default(''),
  foto: text('foto').notNull().default(''),
  createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
});

export const cabor = pgTable(
  'cabor',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    nama: text('nama').notNull(),
    createdAt: doublePrecision('created_at').notNull().$defaultFn(now),
  },
  // unik case-insensitive: "Sepak Bola" dan "SEPAK BOLA" dianggap sama
  (t) => [uniqueIndex('cabor_nama_uq').on(sql`lower(${t.nama})`)],
);
