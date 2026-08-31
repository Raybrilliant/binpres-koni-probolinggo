// Pengelolaan berkas unggahan: konversi gambar ke WebP + pembersihan berkas yatim
import { unlink } from 'node:fs/promises';
import { ENV } from '../env';

/** Hapus berkas hasil upload — dukung URL relatif (/uploads/x) maupun absolut (https://host/uploads/x); link eksternal diabaikan */
export async function removeUploads(urls: Array<string | null | undefined>) {
  for (const u of urls) {
    const path = u && u.includes('/uploads/') ? '/uploads/' + u.split('/uploads/').pop() : '';
    if (!path || path === '/uploads/') continue;
    const name = path.slice('/uploads/'.length).split(/[?#]/)[0];
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) continue;
    try {
      await unlink(`${ENV.UPLOAD_DIR}/${name}`);
    } catch {
      /* berkas sudah tak ada — abaikan */
    }
  }
}
