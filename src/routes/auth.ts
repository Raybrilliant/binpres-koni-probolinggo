import { Elysia, t } from 'elysia';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { authGuard, authPlugin } from '../plugins/auth';
import { ipOf, overLimit } from '../plugins/security';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
  .use(authPlugin)
  .post(
    '/login',
    async function login({ body, jwt, set, request }) {
      // brute-force guard: 10 percobaan/menit per IP+username
      if (overLimit(`l:${ipOf(request.headers)}:${body.username}`, 10)) {
        set.status = 429;
        return { ok: false, error: 'Terlalu banyak percobaan login. Tunggu sebentar.' };
      }
      const row = (
        await db
          .select()
          .from(users)
          .where(sql`lower(${users.username}) = ${body.username.toLowerCase()}`)
          .limit(1)
      )[0];

      let ok = false;
      if (row) ok = await Bun.password.verify(body.password, row.passwordHash);
      // pesan generik: jangan bocorkan apakah username ada
      if (!ok) {
        set.status = 401;
        return { ok: false, error: 'Username atau password salah' };
      }

      const user = { nama: row.nama, username: row.username, cabor: row.cabor, role: row.role };
      const token = await jwt.sign({
        sub: String(row.id),
        nama: row.nama,
        username: row.username,
        cabor: row.cabor,
        role: row.role,
      });
      return { ok: true, token, user };
    },
    {
      detail: {
        tags: ['Auth'],
        description: 'Login dengan username & password. Mengembalikan JWT (berlaku 7 hari) untuk header `Authorization: Bearer <token>`.',
      },
      body: t.Object({
        username: t.String({ minLength: 1, maxLength: 64 }),
        password: t.String({ minLength: 1, maxLength: 128 }),
      }),
    },
  )
  .get(
    '/me',
    ({ user }) => ({ ok: true, user }),
    {
      beforeHandle: authGuard,
      detail: { tags: ['Auth'], description: 'Profil user dari token yang aktif.' },
    },
  );
