import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { ENV } from '../env';

export type Session = {
  id: string;
  nama: string;
  username: string;
  cabor: string;
  role: string;
};

// function-style plugin: derive-nya benar2 diterapkan ke routes konsumen di Elysia 1.4
export const authPlugin = (app: Elysia) =>
  app
    .use(
      jwt({
        name: 'jwt',
        secret: ENV.JWT_SECRET,
        exp: '7d',
      }),
    )
    .derive(async ({ jwt, headers }) => {
    let user: Session | null = null;
    const auth = headers.authorization;
    if (Bun.env.JWT_DEBUG) console.log('[auth] header:', JSON.stringify(auth));
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = (await jwt.verify(auth.slice(7))) as Record<string, string> | false;
        if (Bun.env.JWT_DEBUG) console.log('[auth] verify:', JSON.stringify(payload));
        if (payload && payload.sub)
          user = {
            id: String(payload.sub),
            nama: String(payload.nama ?? ''),
            username: String(payload.username ?? ''),
            cabor: String(payload.cabor ?? ''),
            role: String(payload.role ?? 'Operator'),
          };
      } catch {
        user = null; // token invalid/expired → dianggap tamu
      }
    }
    // admin = cabor Semua ATAU role bukan Operator; operator = operator cabor biasa
    const isAdmin = !!user && (user.cabor === 'Semua' || user.role !== 'Operator');
    return { user, isAdmin };
  });

const deny = (status: number, error: string) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const authGuard = ({ user }: { user: Session | null }) => (user ? undefined : deny(401, 'Silakan login terlebih dahulu'));
export const adminGuard = ({ isAdmin }: { isAdmin: boolean }) => (isAdmin ? undefined : deny(403, 'Hanya admin yang diizinkan'));
