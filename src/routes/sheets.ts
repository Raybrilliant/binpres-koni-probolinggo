import { Elysia } from 'elysia';
import { db } from '../db';
import { atlit, jadwalLatihan, klub, medali, pengurus, pelatih, prestasi, users } from '../db/schema';
import { authGuard, authPlugin } from '../plugins/auth';

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
  );
