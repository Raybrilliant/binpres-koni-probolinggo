// Pengelolaan berkas unggahan: konversi gambar ke WebP + pembersihan berkas yatim
import { unlink } from 'node:fs/promises';
import { ENV } from '../env';

/** Hapus berkas hasil upload (hanya path /uploads/ milik server; link Drive/eksternal diabaikan) */
export async function removeUploads(urls: Array<string | null | undefined>) {
  for (const u of urls) {
    if (!u || !u.startsWith('/uploads/')) continue;
    const name = u.slice('/uploads/'.length).split(/[?#]/)[0];
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) continue;
    try {
      await unlink(`${ENV.UPLOAD_DIR}/${name}`);
    } catch {
      /* berkas sudah tak ada — abaikan */
    }
  }
}
