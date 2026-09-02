import { Elysia, t } from 'elysia';
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { atlit, cabor, jadwalLatihan, klub, medali, pelatih, pengurus, prestasi, users } from '../db/schema';
import { removeUploads } from '../lib/files';
import { adminGuard, authGuard, authPlugin } from '../plugins/auth';

// ==== Registry koleksi: tabel + field yang boleh ditulis dari client ====
const TABLES: Record<string, any> = {
  atlit,
  pelatih,
  jadwal_latihan: jadwalLatihan,
  klub,
  medali,
  users,
  pengurus,
  cabor,
};
const FIELDS: Record<string, string[]> = {
  atlit: ['nama', 'tempatLahir', 'tanggalLahir', 'jenisKelamin', 'alamat', 'kk', 'akte', 'ktp', 'foto', 'cabor', 'proyeksiPorprov'],
  pelatih: ['nama', 'alamat', 'jenisKelamin', 'lisensi', 'fileLisensi', 'foto', 'cabor'],
  jadwal_latihan: ['tempat', 'hari', 'jam', 'cabor'],
  klub: ['nama', 'cabang', 'alamat'],
  medali: ['cabor', 'periode', 'targetEmas', 'targetPerak', 'targetPerunggu', 'hasilEmas', 'hasilPerak', 'hasilPerunggu'],
  users: ['nama', 'username', 'cabor', 'role'],
  pengurus: ['nama', 'jabatan', 'bio', 'foto'],
  cabor: ['nama'],
};
// tabel dengan kepemilikan data (RBAC operator)
const OWNED = new Set(['atlit', 'pelatih', 'jadwal_latihan', 'klub', 'medali']);
// field numerik: string kosong dikonversi 0
const NUMERIC = new Set(['targetEmas', 'targetPerak', 'targetPerunggu', 'hasilEmas', 'hasilPerak', 'hasilPerunggu']);
// hanya admin yang boleh menyentuh
const ADMIN_ONLY = new Set(['users', 'pengurus', 'cabor']);
// field yang menyimpan berkas upload — dihapus otomatis saat baris dihapus/diganti
const DOC_FIELDS: Record<string, string[]> = {
  atlit: ['kk', 'akte', 'ktp', 'foto'],
  pelatih: ['fileLisensi', 'foto'],
  jadwal_latihan: [],
  klub: [],
  users: [],
  pengurus: ['foto'],
};

const url = () => t.Optional(t.String({ maxLength: 2048 }));
const str = (max = 255) => t.Optional(t.String({ maxLength: max }));

const BODY_SCHEMA: Record<string, any> = {
  atlit: t.Object({
    nama: str(150),
    tempatLahir: str(100),
    tanggalLahir: str(10),
    jenisKelamin: str(20),
    alamat: str(500),
    kk: url(),
    akte: url(),
    ktp: url(),
    foto: url(),
    cabor: str(120),
    proyeksiPorprov: t.Optional(t.Union([t.Literal('Ya'), t.Literal('Tidak')])),
    prestasi: t.Optional(
      t.Array(
        t.Object({
          nama: t.Optional(t.String({ maxLength: 200 })),
          tahun: t.Optional(t.Numeric()),
          tingkat: t.Optional(t.String({ maxLength: 50 })),
          piagam: url(),
        }),
        { maxItems: 20 },
      ),
    ),
  }),
  pelatih: t.Object({
    nama: str(150),
    alamat: str(500),
    jenisKelamin: str(20),
    lisensi: str(150),
    fileLisensi: url(),
    foto: url(),
    cabor: str(120),
  }),
  jadwal_latihan: t.Object({
    tempat: str(200),
    hari: str(60),
    jam: str(40),
    cabor: str(120),
  }),
  klub: t.Object({
    nama: str(150),
    cabang: str(120),
    alamat: str(500),
  }),
  medali: t.Object({
    cabor: str(120),
    periode: t.Optional(t.String({ maxLength: 30 })),
    targetEmas: t.Optional(t.Numeric({ minimum: 0 })),
    targetPerak: t.Optional(t.Numeric({ minimum: 0 })),
    targetPerunggu: t.Optional(t.Numeric({ minimum: 0 })),
    hasilEmas: t.Optional(t.Numeric({ minimum: 0 })),
    hasilPerak: t.Optional(t.Numeric({ minimum: 0 })),
    hasilPerunggu: t.Optional(t.Numeric({ minimum: 0 })),
  }),
  users: t.Object({
    nama: str(150),
    username: t.Optional(t.String({ minLength: 3, maxLength: 64 })),
    cabor: str(120),
    role: t.Optional(t.Union([t.Literal('Super Admin'), t.Literal('Admin'), t.Literal('Operator')])),
    password: t.Optional(t.String({ maxLength: 128 })),
  }),
  pengurus: t.Object({
    nama: str(150),
    jabatan: str(150),
    bio: t.Optional(t.String({ maxLength: 2000 })),
    foto: url(),
  }),
  cabor: t.Object({
    nama: t.String({ minLength: 1, maxLength: 120 }),
  }),
};

// field yang dicari saat ?q= (ILIKE — ponytail: full scan; tambah index pg_trgm GIN kalau data tembus 100rb+ baris)
const SEARCH: Record<string, string[]> = {
  atlit: ['nama', 'tempatLahir', 'jenisKelamin', 'alamat', 'cabor', 'proyeksiPorprov'],
  pelatih: ['nama', 'alamat', 'jenisKelamin', 'lisensi', 'cabor'],
  jadwal_latihan: ['tempat', 'cabor', 'hari', 'jam'],
  klub: ['nama', 'cabang', 'alamat'],
  medali: ['cabor', 'periode'],
  users: ['nama', 'username', 'cabor', 'role'],
  pengurus: ['nama', 'jabatan', 'bio'],
  cabor: ['nama'],
};

export const collectionRoutes = new Elysia({ name: 'collections' }).use(authPlugin);

for (const [name, table] of Object.entries(TABLES)) {
  const owned = OWNED.has(name);
  const adminOnly = ADMIN_ONLY.has(name);
  const guards = adminOnly ? [authGuard, adminGuard] : [authGuard];
  const detail = {
    tags: ['Data'],
    description: `${name} — ${adminOnly ? 'khusus admin. ' : ''}${
      owned ? 'operator hanya melihat & mengubah data yang ia buat sendiri. ' : ''
    }Semua endpoint butuh header Authorization: Bearer <token>.`.trim(),
  };

  collectionRoutes.get(
    `/api/${name}`,
    async function list({ user, isAdmin, query }) {
      const page = Math.max(1, Number(query.page ?? 1) || 1);
      const perPage = Math.min(100, Math.max(1, Number(query.perPage ?? 10) || 10));
      const conds: any[] = [];
      // RBAC di SQL (bukan post-filter) agar LIMIT/OFFSET tetap benar
      if (owned && !isAdmin) conds.push(eq(table.createdBy, user!.username));
      if (name === 'medali' && query.periode) conds.push(eq(table.periode, query.periode));
      if (query.q) {
        const like = `%${query.q}%`;
        conds.push(or(...SEARCH[name].map((c) => ilike(table[c], like))));
      }
      const where = conds.length ? and(...conds) : undefined;
      let rows: any[] = await db
        .select()
        .from(table)
        .where(where)
        .orderBy(asc(table.id))
        .limit(perPage)
        .offset((page - 1) * perPage);
      if (name === 'users') rows = rows.map(({ passwordHash: _p, algo: _a, ...rest }) => rest);
      const [cnt] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
      return { ok: true, data: rows, total: Number(cnt?.n ?? 0) };
    },
    {
      beforeHandle: guards,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        perPage: t.Optional(t.Numeric()),
        q: t.Optional(t.String({ maxLength: 100 })),
        periode: t.Optional(t.String({ maxLength: 30 })),
      }),
      detail: {
        ...detail,
        description: `Daftar ${name} terpaginasi (server-side). Query: page, perPage (maks 100), q (pencarian), periode (khusus medali). Balasan { data, total }.`,
      },
    },
  );

  // detail satu baris — dipakai form edit & modal detail atlit (yang butuh daftar prestasi)
  collectionRoutes.get(
    `/api/${name}/:id`,
    async function one({ params, user, isAdmin, set }) {
      const row = (await db.select().from(table).where(eq(table.id, Number(params.id))).limit(1))[0];
      if (!row || (owned && !isAdmin && row.createdBy !== user!.username)) {
        set.status = 404;
        return { ok: false, error: 'Data tidak ditemukan' };
      }
      if (name === 'atlit') row.prestasi = await db.select().from(prestasi).where(eq(prestasi.atlitId, row.id));
      if (name === 'users') {
        const { passwordHash: _p, algo: _a, ...rest } = row as any;
        return { ok: true, data: rest };
      }
      return { ok: true, data: row };
    },
    { beforeHandle: guards, detail: { ...detail, description: `Detail satu ${name} berdasarkan id.` } },
  );

  collectionRoutes.post(
    `/api/${name}`,
    async function create({ body, user, isAdmin, set }) {
      const b = body as Record<string, any>;
      const values: Record<string, unknown> = {};
      for (const k of FIELDS[name]) {
        const v = b[k];
        values[k] = NUMERIC.has(k) ? Number(v) || 0 : v === undefined || v === null ? '' : v;
      }
      if (name === 'atlit') values.proyeksiPorprov = values.proyeksiPorprov || 'Tidak';

      // RBAC server-side: pembuat dicatat dari token, operator terkunci ke cabor-nya
      if (owned && !isAdmin) {
        values.createdBy = user!.username;
        if ('cabor' in values && user!.cabor !== 'Semua') values.cabor = user!.cabor;
      }
      if (name === 'users') {
        const pw = String(b.password ?? '');
        if (pw.length < 6) {
          set.status = 400;
          return { ok: false, error: 'Password minimal 6 karakter' };
        }
        const dup = await db
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.username}) = ${String(values.username).toLowerCase()}`)
          .limit(1);
        if (dup.length) {
          set.status = 409;
          return { ok: false, error: 'Username sudah dipakai' };
        }
        values.passwordHash = await Bun.password.hash(pw);
        delete (values as any).password;
      }

      if (name === 'atlit' && Array.isArray(b.prestasi)) {
        const list = b.prestasi;
        let newId = 0;
        await db.transaction(async (tx: any) => {
          const [ins] = await tx.insert(table).values(values).returning({ id: table.id });
          newId = ins.id;
          if (list.length)
            await tx.insert(prestasi).values(
              list.map((p: any) => ({
                atlitId: ins.id,
                nama: p.nama ?? '',
                tahun: Number(p.tahun) || 0,
                tingkat: p.tingkat ?? '',
                piagam: p.piagam ?? '',
              })),
            );
        });
        return { ok: true, id: newId };
      }

      const [ins] = await db.insert(table).values(values).returning({ id: table.id });
      return { ok: true, id: ins.id };
    },
    {
      beforeHandle: guards,
      body: BODY_SCHEMA[name],
      detail: { ...detail, description: `Tambah ${name}. ${detail.description}` },
    },
  );

  collectionRoutes.patch(
    `/api/${name}/:id`,
    async function update({ body, params, user, isAdmin, set }) {
      const existing = (await db.select().from(table).where(eq(table.id, Number(params.id))).limit(1))[0];
      // 404 (bukan 403) agar keberadaan data orang lain tidak bocor
      if (!existing || (owned && !isAdmin && existing.createdBy !== user!.username)) {
        set.status = 404;
        return { ok: false, error: 'Data tidak ditemukan' };
      }

      const b = body as Record<string, any>;
      // berkas lama yang diganti diupdate ini → dihapus setelah update sukses
      const replaced: string[] = [];
      for (const k of DOC_FIELDS[name] ?? [])
        if (b[k] !== undefined && b[k] !== existing[k]) replaced.push(existing[k] as string);
      // prestasi lama utk atlit: piagam yang tidak lagi ada di daftar baru dihapus
      let oldPrestasi: { piagam: string }[] = [];
      if (name === 'atlit' && Array.isArray(b.prestasi))
        oldPrestasi = await db.select().from(prestasi).where(eq(prestasi.atlitId, Number(params.id)));
      const values: Record<string, unknown> = {};
      for (const k of FIELDS[name]) if (b[k] !== undefined) values[k] = NUMERIC.has(k) ? Number(b[k]) || 0 : b[k];

      if (name === 'users') {
        if (b.password) {
          values.passwordHash = await Bun.password.hash(String(b.password));
          values.algo = 'bun';
        }
      }
      if (owned && !isAdmin && 'cabor' in values) values.cabor = user!.cabor; // operator tak bisa ganti cabor

      if (name === 'atlit' && Array.isArray(b.prestasi)) {
        // sinkronisasi prestasi: hapus semua lalu insert ulang by atlitId
        const list = b.prestasi;
        await db.transaction(async (tx: any) => {
          if (Object.keys(values).length) await tx.update(table).set(values).where(eq(table.id, Number(params.id)));
          await tx.delete(prestasi).where(eq(prestasi.atlitId, Number(params.id)));
          if (list.length)
            await tx.insert(prestasi).values(
              list.map((p: any) => ({
                atlitId: Number(params.id),
                nama: p.nama ?? '',
                tahun: Number(p.tahun) || 0,
                tingkat: p.tingkat ?? '',
                piagam: p.piagam ?? '',
              })),
            );
        });
        return { ok: true };
      }

      await removeUploads(replaced);
      if (!Object.keys(values).length) return { ok: true };
      await db.update(table).set(values).where(eq(table.id, Number(params.id)));
      return { ok: true };
    },
    {
      beforeHandle: guards,
      body: BODY_SCHEMA[name],
      detail: { ...detail, description: `Ubah ${name} berdasarkan id. ${detail.description}` },
    },
  );

  collectionRoutes.delete(
    `/api/${name}/:id`,
    async function remove({ params, user, isAdmin, set }) {
      const existing = (await db.select().from(table).where(eq(table.id, Number(params.id))).limit(1))[0];
      if (!existing || (owned && !isAdmin && existing.createdBy !== user!.username)) {
        set.status = 404;
        return { ok: false, error: 'Data tidak ditemukan' };
      }
      if (name === 'users' && existing.id === Number(user!.id)) {
        set.status = 400;
        return { ok: false, error: 'Tidak bisa menghapus akun sendiri' };
      }
      // kumpulkan berkas terkait SEBELUM baris hilang (piagam prestasi ikut cascade via FK)
      const files = (DOC_FIELDS[name] ?? []).map((k) => existing[k] as string);
      if (name === 'atlit') {
        const ps = await db.select().from(prestasi).where(eq(prestasi.atlitId, Number(params.id)));
        files.push(...ps.map((p: any) => p.piagam));
      }
      // prestasi ikut terhapus lewat FK onDelete cascade
      await db.delete(table).where(eq(table.id, Number(params.id)));
      await removeUploads(files);
      return { ok: true };
    },
    {
      beforeHandle: guards,
      detail: { ...detail, description: `Hapus ${name} berdasarkan id. ${detail.description}` },
    },
  );
}
