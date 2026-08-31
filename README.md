# BINPRES KONI — Backend (Elysia + Drizzle + SQLite)

Backend REST untuk panel admin & landing page BINPRES KONI Kota Probolinggo.
Dibangun dengan **Bun + ElysiaJS + DrizzleORM (bun:sqlite)**, dokumentasi OpenAPI otomatis di `/swagger`.

## Menjalankan

```bash
bun install
cp .env.example .env       # wajib isi DB_URL & JWT_SECRET
bun run db:push            # buat/mutakan tabel di PostgreSQL
bun run dev                # http://localhost:3000 (docs: /swagger)
```

## Membuat akun admin pertama

```bash
bun run admin:create adminkoni passwordKuat123
```

- Jika username belum ada → dibuat sebagai Super Admin (`cabor: Semua`).
- Jika sudah ada → password-nya direset.

## Migrasi dari SQLite (selesai)

Data warisan SQLite sudah dimigrasi ke PostgreSQL: `bun run migrate:sqlite`
(id lama dipertahankan, sequence disamakan). Google Apps Script sudah tidak
dipakai sama sekali — backend ini satu-satunya sumber data.

## Endpoint utama

| Method | Path | Keterangan |
|---|---|---|
| POST | `/api/auth/login` | Login → `{ token, user }` |
| GET | `/api/auth/me` | Profil dari token |
| GET | `/api/public/summary` | Publik: jumlah atlit/pelatih/klub + pengurus (landing) |
| GET | `/api/sheets/all` | Semua data (login; operator terbatas ke datanya) |
| GET/POST | `/api/{atlit\|pelatih\|jadwal_latihan\|klub\|users\|pengurus}` | List & tambah |
| PATCH/DELETE | `/api/{koleksi}/:id` | Ubah & hapus |
| POST | `/api/upload` | Unggah gambar/PDF **maks 3MB** → `{ url }` (gambar dikonversi WebP) |
| GET | `/uploads/:file` | Berkas yang sudah diunggah |
| GET | `/swagger` | Dokumentasi OpenAPI interaktif |

Catatan:
- `prestasi` tidak punya endpoint sendiri — dikelola lewat payload `prestasi[]` pada atlit (create/update sinkron delete+insert by `atlitId`, hapus atlit ikut menghapus prestasinya via FK cascade).
- RBAC: admin (`cabor = Semua` / role selain Operator) melihat semuanya; operator hanya melihat & mengubah data yang ia buat (`createdBy`), dan cabor data yang ia buat dikunci ke cabor akunnya di sisi server.
- Field dokumen (kk/akte/ktp/piagam/fileLisensi/foto) berisi URL hasil `/api/upload`, bukan lagi link Google Drive.
- Menghapus data otomatis menghapus berkas terkait; mengganti dokumen menghapus berkas lamanya.

## Keamanan & performa

- Password: **argon2id** (`Bun.password`), JWT **7 hari** (`Authorization: Bearer`).
- Rate limit: global 300 req/menit per IP, login 10 percobaan/menit per IP+username.
- Header keamanan (nosniff, frame-deny, referrer-policy, permissions-policy) di semua respons.
- Validasi body ketat (TypeBox), pesan error login generik (anti user-enumeration).
- PostgreSQL dengan koneksi pool bawaan `Bun.sql`; index pada `created_by` & `atlit_id`, `username` unik.

## Produksi

1. `JWT_SECRET` wajib diganti (server menolak jalan bila masih default).
2. Arahkan reverse proxy (Nginx/Caddy) `/api` + `/uploads` + `/swagger` ke port ini, dan set `CORS_ORIGIN` ke domain frontend.
3. Backup rutin database PostgreSQL (`pg_dump`).
4. Berkas unggahan tersimpan di `uploads/` — ikutkan ke backup, atau pindahkan ke object storage (S3) bila volume membesar.
