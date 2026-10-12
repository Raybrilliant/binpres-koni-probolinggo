// Konfigurasi identitas situs — satu sumber kebenaran untuk meta tag,
// canonical, Open Graph, sitemap, robots.txt, dan JSON-LD.
// Set PUBLIC_SITE_URL di .env produksi (tanpa trailing slash), cth:
// PUBLIC_SITE_URL=https://binpres.koniprobolinggo.example
export const SITE = {
  name: 'BINPRES KONI Kota Probolinggo',
  shortName: 'BINPRES KONI',
  tagline: 'Bina Prestasi, Wujudkan Juara Muda',
  url: (import.meta.env.PUBLIC_SITE_URL ?? 'http://localhost:4321').replace(/\/+$/, ''),
  locale: 'id_ID',
  lang: 'id',
  description:
    'Program BINPRES KONI Kota Probolinggo untuk membina atlet muda lintas cabang olahraga, penguatan pelatih, dan fasilitasi klub menuju prestasi nasional.',
  telephone: '+6285233062968',
  whatsapp: 'https://wa.me/6285233062968',
  ogImage: '/pexels/hero.jpg',
  logo: '/logo.png',
  address: {
    street: 'Jl. Slamet Riyadi No. 143, Kel. Kanigaran, Kec. Kanigaran',
    city: 'Kota Probolinggo',
    region: 'Jawa Timur',
    country: 'ID',
  },
} as const;

export const absoluteUrl = (path: string) => new URL(path, `${SITE.url}/`).toString();

// URL backend untuk fetch sisi server (SSR). PUBLIC_API_URL dipakai browser;
// PRIVATE_API_URL opsional bila server perlu menembus host internal berbeda.
// Trailing slash dibuang agar tidak jadi double-slash saat digabung path.
export const API_SERVER: string = (
  (import.meta.env.PRIVATE_API_URL as string | undefined) ??
  (import.meta.env.PUBLIC_API_URL as string | undefined) ??
  'http://127.0.0.1:3000'
).replace(/\/+$/, '');

// Pertanyaan umum — sumber tunggal untuk section FAQ & JSON-LD FAQPage
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Apa itu BINPRES KONI Kota Probolinggo?',
    a: 'BINPRES (Bidang Pembinaan Prestasi) adalah program KONI Kota Probolinggo untuk membina atlet muda berbakat lintas cabang olahraga — mencakup pembinaan prestasi atlet, penguatan kompetensi pelatih, serta fasilitasi klub/dojang/perguruan di Kota Probolinggo.',
  },
  {
    q: 'Fokus pembinaan apa saja yang dijalankan?',
    a: 'Ada empat fokus utama: penguatan prestasi atlet hingga kancah nasional, program pelatihan terencana melalui Puslatcab/Puslatkot, penerapan sport intelligence berbasis data atlet, serta sinergi antara KONI, Pemerintah Daerah, dan induk cabang olahraga.',
  },
  {
    q: 'Cabang olahraga apa saja yang dibina?',
    a: 'Pembinaan mencakup puluhan cabang olahraga yang dikelola bersama induk cabang olahraga (cabor) di Kota Probolinggo. Daftar lengkap cabang olahraga terbaru tersedia pada bagian Cabang Olahraga di halaman ini.',
  },
  {
    q: 'Bagaimana cara atlet, pelatih, atau klub bergabung?',
    a: 'Pendaftaran dilakukan melalui panel admin BINPRES KONI pada tautan "Gabung Sekarang" setelah mendapatkan akses dari pengurus, atau dengan menghubungi pengurus langsung melalui WhatsApp.',
  },
  {
    q: 'Di mana alamat dan kontak KONI Kota Probolinggo?',
    a: 'Sekretariat berada di Jl. Slamet Riyadi No. 143, Kel. Kanigaran, Kec. Kanigaran, Kota Probolinggo. Kontak resmi: 0852-3306-2968 (WhatsApp).',
  },
];
