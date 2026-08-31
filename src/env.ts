import { mkdirSync } from 'node:fs';

const def = (v: string | undefined, f: string) => (v && v.trim() ? v.trim() : f);

export const ENV = {
  PORT: Number(Bun.env.PORT ?? 3000),
  JWT_SECRET: def(Bun.env.JWT_SECRET, 'dev-secret-ganti-di-produksi-jangan-pakai-ini'),
  CORS_ORIGIN: def(Bun.env.CORS_ORIGIN, 'http://localhost:4321')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  DB_URL: def(Bun.env.DB_URL, ''),
  UPLOAD_DIR: def(Bun.env.UPLOAD_DIR, 'uploads'),
  RATE_LIMIT: Number(Bun.env.RATE_LIMIT ?? 300),
};

if (!ENV.DB_URL) throw new Error('DB_URL wajib diisi di .env (postgresql://user:pass@host:5432/db)');
if (Bun.env.NODE_ENV === 'production' && ENV.JWT_SECRET.startsWith('dev-secret'))
  throw new Error('JWT_SECRET wajib diganti sebelum jalan di produksi');

// pastikan folder penyimpanan ada
mkdirSync(ENV.UPLOAD_DIR, { recursive: true });
