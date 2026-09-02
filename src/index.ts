import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { Elysia } from 'elysia';
import { ENV } from './env';
import { authRoutes } from './routes/auth';
import { collectionRoutes } from './routes/collections';
import { sheetRoutes } from './routes/sheets';
import { filesRoutes, uploadRoutes } from './routes/upload';
import { security } from './plugins/security';

const app = new Elysia({ serve: { maxRequestBodySize: 8 * 1024 * 1024 } })
  .use(cors({ origin: ENV.CORS_ORIGIN }))
  .use(security)
  .use(
    swagger({
      path: '/swagger',
      documentation: {
        info: {
          title: 'BINPRES KONI Kota Probolinggo — API',
          version: '1.0.0',
          description:
            'API backend Bina Prestasi KONI Kota Probolinggo. Login di `/api/auth/login` untuk mendapat JWT, lalu kirim header `Authorization: Bearer <token>`. Dokumen (kk/akte/ktp/piagam/lisensi/foto) berupa URL hasil unggahan `/api/upload`.',
        },
        tags: [
          { name: 'Auth', description: 'Login & profil' },
          { name: 'Data', description: 'CRUD atlit, prestasi, pelatih, jadwal latihan, klub, users, pengurus' },
          { name: 'Upload', description: 'Unggah gambar/PDF maks 3MB' },
          { name: 'Public', description: 'Endpoint publik untuk landing page' },
          { name: 'Meta', description: 'Health check & dokumentasi' },
        ],
      },
    }),
  )
  .get('/api/health', () => ({ ok: true, service: 'binpres-backend', time: Date.now() }), {
    detail: { tags: ['Meta'] },
  })
  // onError harus terdaftar SEBELUM route/plugin agar berlaku ke semuanya
  .onError(function handler({ code, error, set }) {
    if (code === 'VALIDATION') {
      set.status = 422;
      return { ok: false, error: 'Data tidak valid', detail: (error as any).all };
    }
    if (code === 'PARSE') {
      set.status = 400;
      return { ok: false, error: 'Body permintaan tidak valid' };
    }
    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { ok: false, error: 'Endpoint tidak ditemukan' };
    }
    // drizzle membungkus error pg di .cause — cek keduanya
    const msg = ((error as Error)?.message ?? '') + ' ' + ((error as any)?.cause?.message ?? '');
    // unique violation: SQLite "UNIQUE constraint", Postgres "duplicate key ... unique constraint" (23505)
    if (msg.includes('UNIQUE constraint') || msg.includes('duplicate key') || msg.includes('unique constraint')) {
      set.status = 409;
      return { ok: false, error: 'Data sudah ada (nama/username duplikat?)' };
    }
    console.error('[error]', error);
    set.status = 500;
    return { ok: false, error: 'Kesalahan server' };
  })
  .use(authRoutes)
  .use(sheetRoutes)
  .use(collectionRoutes)
  .use(uploadRoutes)
  .use(filesRoutes)
  .listen(ENV.PORT);

console.log(`🦊 BINPRES backend jalan di http://localhost:${app.server?.port}`);
console.log(`📖 OpenAPI docs: http://localhost:${app.server?.port}/swagger`);
