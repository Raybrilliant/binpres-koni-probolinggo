import { db } from '../src/db';
import { pengurus } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const rows = [
  {
    nama: 'JUSDI M',
    jabatan: 'Koordinator Bidang Binpres',
    bio: 'Sarjana Kepelatihan Olahraga yang menjabat sebagai Koordinator Bidang Pembinaan Prestasi (Binpres) KONI Kota Probolinggo periode 2021–2025 dan berlanjut pada periode 2025–2029. Aktif sebagai Head Coach Cabor Petanque sejak tahun 2016.',
    foto: '/uploads/pengurus-jusdi-m.jpeg',
  },
  {
    nama: 'AGUS SALIM',
    jabatan: 'Anggota Bidang Binpres',
    bio: 'Anggota Bidang Pembinaan Prestasi KONI Kota Probolinggo periode 2025–2029. Menjabat sebagai Ketua Cabor Aquatik sejak tahun 2018.',
    foto: '/uploads/pengurus-agus-salim.jpeg',
  },
  {
    nama: 'AGUS TRI WAHYUDI',
    jabatan: 'Anggota Bidang Binpres',
    bio: 'Anggota Bidang Pembinaan Prestasi KONI Kota Probolinggo periode 2025–2029. Menjabat sebagai Ketua Cabor Catur periode 2023–2027.',
    foto: '/uploads/pengurus-agus-tri-wahyudi.jpeg',
  },
  {
    nama: 'NUR CHOLIQ',
    jabatan: 'Anggota Bidang Binpres',
    bio: 'Anggota Bidang Pembinaan Prestasi KONI Kota Probolinggo periode 2025–2029. Menjabat sebagai Ketua Cabor Angkat Berat periode 2024–2028.',
    foto: '/uploads/pengurus-nur-choliq.jpeg',
  },
  {
    nama: 'AMAK FADHOL',
    jabatan: 'Anggota Bidang Binpres',
    bio: 'Anggota Bidang Pembinaan Prestasi KONI Kota Probolinggo periode 2025–2029. Menjabat sebagai Ketua sekaligus Head Coach Cabor Wushu sejak tahun 2018.',
    foto: '/uploads/pengurus-amak-fadhol.jpeg',
  },
];

for (const r of rows) {
  const existing = (await db.select().from(pengurus).where(eq(pengurus.nama, r.nama)).limit(1))[0];
  if (existing) {
    await db.update(pengurus).set(r).where(eq(pengurus.id, existing.id));
    console.log(`♻️  update: ${r.nama}`);
  } else {
    await db.insert(pengurus).values(r);
    console.log(`✅ insert: ${r.nama}`);
  }
}
console.log('🎉 Seed pengurus selesai.');
process.exit(0);
