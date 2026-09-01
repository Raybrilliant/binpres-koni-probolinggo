import { Elysia } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { atlit, jadwalLatihan, klub, medali, pengurus, pelatih, prestasi, users } from '../db/schema';
import { adminGuard, authGuard, authPlugin } from '../plugins/auth';

const stripUser = (u: Record<string, unknown>) => {
  const { passwordHash: _ph, algo: _a, ...rest } = u;
  return rest;
};

export const sheetRoutes = new Elysia({ prefix: '/api' })
  .use(authPlugin)
  .get(
    '/public/summary',
    async () => {
      // publik (untuk landing page): identitas ringkas TANPA dokumen & alamat lengkap
      const [a, p, k, pg] = await Promise.all([
        db.select().from(atlit),
        db.select().from(pelatih),
        db.select().from(klub),
        db.select().from(pengurus),
      ]);
      return {
        ok: true,
        data: {
          atlit: a.map((r: any) => ({
            id: r.id, nama: r.nama, tempatLahir: r.tempatLahir, tanggalLahir: r.tanggalLahir,
            jenisKelamin: r.jenisKelamin, cabor: r.cabor, proyeksiPorprov: r.proyeksiPorprov,
          })),
          pelatih: p.map((r: any) => ({ id: r.id, nama: r.nama, jenisKelamin: r.jenisKelamin, cabor: r.cabor })),
          klub: k.map((r: any) => ({ id: r.id, nama: r.nama, cabang: r.cabang })),
          jadwal_latihan: [],
          users: [],
          pengurus: pg,
        },
      };
    },
    { detail: { tags: ['Public'], description: 'Ringkasan publik untuk landing page: jumlah atlit/pelatih/klub + daftar pengurus. Tanpa dokumen pribadi.' } },
  )
  .get(
    '/sheets/all',
    async ({ user, isAdmin }) => {
      // operator hanya melihat data miliknya sendiri (RBAC)
      const scoped = !isAdmin && user?.cabor !== 'Semua';
      const [at, ps, pl, jd, kl, md, us, pg] = await Promise.all([
        db.select().from(atlit),
        db.select().from(prestasi),
        db.select().from(pelatih),
        db.select().from(jadwalLatihan),
        db.select().from(klub),
        db.select().from(medali),
        db.select().from(users),
        db.select().from(pengurus),
      ]);
      const prestasiBy = new Map<string, unknown[]>();
      for (const p of ps) {
        const arr = prestasiBy.get(p.atlitId) ?? [];
        arr.push(p);
        prestasiBy.set(p.atlitId, arr);
      }
      const atlitRows = (scoped ? at.filter((r: any) => r.createdBy === user?.username) : at).map((r: any) => ({
        ...r,
        prestasi: prestasiBy.get(r.id) ?? [],
      }));
      return {
        ok: true,
        data: {
          atlit: atlitRows,
          prestasi: scoped ? ps.filter((p: any) => atlitRows.some((a: any) => a.id === p.atlitId)) : ps,
          pelatih: scoped ? pl.filter((r: any) => r.createdBy === user?.username) : pl,
          jadwal_latihan: scoped ? jd.filter((r: any) => r.createdBy === user?.username) : jd,
          klub: scoped ? kl.filter((r: any) => r.createdBy === user?.username) : kl,
          medali: scoped ? md.filter((r: any) => r.createdBy === user?.username) : md,
          users: us.map(stripUser),
          pengurus: pg,
        },
      };
    },
    {
      beforeHandle: authGuard,
      detail: { tags: ['Data'], description: 'Seluruh data untuk panel admin (butuh login). Operator otomatis terbatas ke data buatannya sendiri; users tanpa hash password.' },
    },
  )
  .get(
    '/stats',
    async () => {
      // semua agregasi dikerjakan SQL (GROUP BY/SUM) — client tidak pernah menarik seluruh baris
      const num = sql<number>`count(*)::int`;
      const [totals, atlitPerCabor, pelatihPerCabor, klubPerCabang, proyeksi, medaliAgg, tingkatRows, prestasiTotal] =
        await Promise.all([
          Promise.all([
            db.select({ n: num }).from(atlit),
            db.select({ n: num }).from(pelatih),
            db.select({ n: num }).from(jadwalLatihan),
            db.select({ n: num }).from(klub),
            db.select({ n: num }).from(medali),
            db.select({ n: num }).from(users),
            db.select({ n: num }).from(pengurus),
          ]),
          db.select({ name: atlit.cabor, count: num }).from(atlit).groupBy(atlit.cabor),
          db.select({ name: pelatih.cabor, count: num }).from(pelatih).groupBy(pelatih.cabor),
          db.select({ name: klub.cabang, count: num }).from(klub).groupBy(klub.cabang),
          db
            .select({ name: atlit.cabor, count: num })
            .from(atlit)
            .where(eq(atlit.proyeksiPorprov, 'Ya'))
            .groupBy(atlit.cabor),
          db
            .select({
              te: sql<number>`coalesce(sum(${medali.targetEmas}), 0)::int`,
              tp: sql<number>`coalesce(sum(${medali.targetPerak}), 0)::int`,
              tb: sql<number>`coalesce(sum(${medali.targetPerunggu}), 0)::int`,
              he: sql<number>`coalesce(sum(${medali.hasilEmas}), 0)::int`,
              hp: sql<number>`coalesce(sum(${medali.hasilPerak}), 0)::int`,
              hb: sql<number>`coalesce(sum(${medali.hasilPerunggu}), 0)::int`,
            })
            .from(medali),
          db
            .select({ name: sql<string>`coalesce(nullif(${prestasi.tingkat}, ''), 'Lainnya')`, count: num })
            .from(prestasi)
            .groupBy(sql`1`),
          db.select({ n: num }).from(prestasi),
        ]);
      const desc = (a: { name: string; count: number }, b: { name: string; count: number }) =>
        b.count - a.count || a.name.localeCompare(b.name);
      const clean = (arr: { name: string; count: number }[]) =>
        arr
          .filter((x) => String(x.name ?? '').trim())
          .map((x) => ({ name: String(x.name), count: Number(x.count) }))
          .sort(desc);
      const m = medaliAgg[0];
      return {
        ok: true,
        stats: {
          totals: {
            atlit: Number(totals[0][0]?.n ?? 0),
            pelatih: Number(totals[1][0]?.n ?? 0),
            jadwal: Number(totals[2][0]?.n ?? 0),
            klub: Number(totals[3][0]?.n ?? 0),
            medali: Number(totals[4][0]?.n ?? 0),
            users: Number(totals[5][0]?.n ?? 0),
            pengurus: Number(totals[6][0]?.n ?? 0),
          },
          atlitPerCabor: clean(atlitPerCabor as any),
          pelatihPerCabor: clean(pelatihPerCabor as any),
          klubPerCabang: clean(klubPerCabang as any),
          atlitProyeksi: clean(proyeksi as any).filter((x) => x.count > 0),
          medaliTotal: {
            t: { e: Number(m?.te ?? 0), p: Number(m?.tp ?? 0), b: Number(m?.tb ?? 0) },
            h: { e: Number(m?.he ?? 0), p: Number(m?.hp ?? 0), b: Number(m?.hb ?? 0) },
          },
          prestasiTingkat: { total: Number(prestasiTotal[0]?.n ?? 0), rows: clean(tingkatRows as any) },
        },
      };
    },
    {
      beforeHandle: [authGuard, adminGuard],
      detail: { tags: ['Data'], description: 'Agregasi statistik dashboard (GROUP BY di SQL). Khusus admin.' },
    },
  );
