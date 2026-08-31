import { Elysia, t } from 'elysia';
import { unlink } from 'node:fs/promises';
import { ENV } from '../env';
import { authGuard, authPlugin } from '../plugins/auth';

const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const uploadRoutes = new Elysia({ prefix: '/api' })
  .use(authPlugin)
  .post(
    '/upload',
    // @ts-ignore body.file bertipe File setelah parse multipart
    async function upload({ body, set }) {
      const file = (body as { file?: File }).file;
      if (!(file instanceof File)) {
        set.status = 400;
        return { ok: false, error: 'Berkas tidak ditemukan' };
      }
      if (file.size > MAX_BYTES) {
        set.status = 413;
        return { ok: false, error: 'Ukuran berkas maksimal 3MB' };
      }
      const ext = EXT[file.type];
      if (!ext) {
        set.status = 415;
        return { ok: false, error: 'Hanya gambar JPG/PNG/WebP atau PDF yang diizinkan' };
      }
      const base = crypto.randomUUID();
      let stored = `${base}.${ext}`;
      let url = `/uploads/${stored}`;
      await Bun.write(`${ENV.UPLOAD_DIR}/${stored}`, file);
      // gambar dikompres & dikonversi ke WebP utk hemat storage; gagal → simpan format asli
      if (file.type.startsWith('image/')) {
        try {
          const webpName = `${base}.webp`;
          await Bun.file(`${ENV.UPLOAD_DIR}/${stored}`)
            .image()
            .webp({ quality: 82 })
            .write(`${ENV.UPLOAD_DIR}/${webpName}`);
          await unlink(`${ENV.UPLOAD_DIR}/${stored}`);
          stored = webpName;
          url = `/uploads/${webpName}`;
        } catch {
          /* konversi tak tersedia/gagal → simpan format asli */
        }
      }
      return { ok: true, url };
    },
    {
      beforeHandle: authGuard,
      body: t.Object({ file: t.File() }),
      detail: {
        tags: ['Upload'],
        description:
          'Unggah gambar (JPG/PNG/WebP) atau PDF maksimal 3MB. Balasan `{ url }` dipakai sebagai nilai field dokumen (kk/akte/ktp/piagam/lisensi/foto). Butuh login.',
      },
    },
  );

// penyajian berkas statis dengan nama yang sudah disanitasi (hanya UUID.ext)
export const filesRoutes = new Elysia().get('/uploads/:name', async ({ params, set }) => {
  if (!/^[A-Za-z0-9._-]+$/.test(params.name) || params.name.includes('..')) {
    set.status = 400;
    return 'Nama berkas tidak valid';
  }
  const file = Bun.file(`${ENV.UPLOAD_DIR}/${params.name}`);
  if (!(await file.exists())) {
    set.status = 404;
    return 'Berkas tidak ditemukan';
  }
  const ext = params.name.split('.').pop() ?? '';
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };
  return new Response(file, {
    headers: {
      'content-type': types[ext] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
});
