export type Row = Record<string, any>;
export type Field = { key: string; label: string; type?: string; ph?: string };
export type Section = { id: string; label: string; icon: string; fields: Field[]; rows: Row[] };

// 46 cabang olahraga binaan KONI Kota Probolinggo (sesuai data resmi)
export const CABOR: string[] = [
  'AKUATIK (AI)', 'ANGGAR (IKASI)', 'ANGKAT BERAT (PABERSI)', 'ANGKAT BESI (PABSI)',
  'ATLETIK (PASI)', 'BALAP SEPEDA (ISSI)', 'BERKUDA (PORDASI)', 'BERMOTOR (IMI)',
  'BILIARD (POBSI)', 'BINARAGA (PBFI)', 'BOLA TANGAN (ABTI)',
  'BOLA VOLI (PBVSI)', 'BRIDGE (GABSI)', 'BULU TANGKIS (PBSI)', 'CATUR (PERCASI)',
  'DANCESPORT (IODI)', 'DAYUNG (PODSI)', 'DOMINO (ORADO)', 'DRUMBAND (PDBI)',
  'FUTSAL (AFI)', 'HAPKIDO (HI)', 'KARATE (FORKI)', 'KURASH (FERKUSHI)',
  'MENEMBAK (PERBAKIN)', 'MUATHAY (MI)', 'PANAHAN (PERPANI)', 'PANJAT TEBING (FPTI)',
  'PENCAK SILAT (IPSI)', 'PETANQUE (FOPI)', 'SELAM (POSSI)', 'SENAM (PERSANI)',
  'SEPAK BOLA (PSSI)', 'SEPAK TAKRAW (PSTI)', 'SEPATU RODA (PERSEROSI)', 'SKY AIR (PSAWI)',
  'TAE KWON DO (TI)', 'TARUNG DRAJAT (KODRAT)', 'TENIS (PELTI)', 'TENIS MEJA (PTMSI)',
  'TINJU (PERTINA)', 'TRIATHLON (FTI)', 'WUSHU (WI)', 'ARUNG JERAM (FAJI)',
  'GATEBALL (PERGATSI)', 'IBCA MMA', 'PARAMOTOR (FASI)',
] as const;

// periode PORPROV (2 tahunan) mulai 2027: 2027, 2029, 2031, ...
export const PERIODE: string[] = Array.from({ length: 9 }, (_, i) => String(2027 + i * 2));

// Astro static site: env ber-prefix PUBLIC_ yang sampai ke client.
// Kosong = same-origin (dev: proxy Vite → :3000, produksi: reverse proxy).
export const API: string = (import.meta.env.PUBLIC_API_URL ?? '') as string;

// mapping id section frontend → nama koleksi di backend
const SHEET: Record<string, string> = {
  atlit: 'atlit',
  pelatih: 'pelatih',
  jadwal: 'jadwal_latihan',
  klub: 'klub',
  medali: 'medali',
  users: 'users',
  pengurus: 'pengurus',
};

let token: string | null = null;
if (typeof localStorage !== 'undefined') token = localStorage.getItem('binpres-token');

async function api(path: string, init: RequestInit = {}): Promise<any> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...(isForm ? {} : { 'content-type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // sesi kadaluarsa/token invalid → bersihkan sesi
  if (res.status === 401 && token) clearSession();
  return res.json();
}

function clearSession() {
  token = null;
  auth.user = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('binpres-token');
    localStorage.removeItem('binpres-user');
  }
  syncLabels();
}

function seed(): Section[] {
  return [
    {
      id: 'atlit',
      label: 'Atlit',
      icon: '🏃',
      fields: [
        { key: 'nama', label: 'Nama' },
        { key: 'tempatLahir', label: 'Tempat Lahir' },
        { key: 'tanggalLahir', label: 'Tanggal Lahir', type: 'date' },
        { key: 'jenisKelamin', label: 'Jenis Kelamin' },
        { key: 'cabor', label: 'Cabang Olahraga' },
        { key: 'proyeksiPorprov', label: 'Proyeksi Porprov X' },
      ],
      rows: [],
    },
    {
      id: 'pelatih',
      label: 'Pelatih',
      icon: '🎯',
      fields: [
        { key: 'nama', label: 'Nama' },
        { key: 'alamat', label: 'Alamat' },
        { key: 'jenisKelamin', label: 'Jenis Kelamin' },
        { key: 'lisensi', label: 'Lisensi Pelatih' },
        { key: 'cabor', label: 'Cabang Olahraga' },
      ],
      rows: [],
    },
    {
      id: 'jadwal',
      label: 'Jadwal Latihan',
      icon: '📅',
      fields: [
        { key: 'tempat', label: 'Tempat Latihan' },
        { key: 'cabor', label: 'Cabang Olahraga' },
        { key: 'hari', label: 'Hari Latihan' },
        { key: 'jam', label: 'Jam Latihan' },
      ],
      rows: [],
    },
    {
      id: 'klub',
      label: 'Nama Klub/Dojang/Perguruan',
      icon: '🏟️',
      fields: [
        { key: 'nama', label: 'Nama Klub/Dojang/Perguruan' },
        { key: 'cabang', label: 'Cabang Olahraga', ph: 'cth: SEPAK BOLA (PSSI)' },
        { key: 'alamat', label: 'Alamat' },
      ],
      rows: [],
    },
    {
      id: 'medali',
      label: 'Target & Perolehan Medali',
      icon: '🏅',
      fields: [
        { key: 'cabor', label: 'Cabang Olahraga' },
        { key: 'periode', label: 'Periode' },
        { key: 'targetEmas', label: 'Target Emas' },
        { key: 'targetPerak', label: 'Target Perak' },
        { key: 'targetPerunggu', label: 'Target Perunggu' },
        { key: 'hasilEmas', label: 'Emas' },
        { key: 'hasilPerak', label: 'Perak' },
        { key: 'hasilPerunggu', label: 'Perunggu' },
      ],
      rows: [],
    },
    {
      id: 'pengurus',
      label: 'Manajemen Pengurus',
      icon: '👔',
      fields: [
        { key: 'nama', label: 'Nama' },
        { key: 'jabatan', label: 'Jabatan' },
      ],
      rows: [],
    },
    {
      id: 'users',
      label: 'Manajemen User',
      icon: '👥',
      fields: [
        { key: 'nama', label: 'Nama' },
        { key: 'username', label: 'Username' },
        { key: 'cabor', label: 'Cabang Olahraga' },
        { key: 'role', label: 'Role' },
      ],
      rows: [],
    },
  ];
}

function loadLocal(): Section[] {
  // mode backend: selalu mulai kosong, data diambil dari server saat refresh()
  return seed().map((s) => ({ ...s, rows: [] }));
}

export const db = $state<{ sections: Section[] }>({ sections: loadLocal() });

// sekali jalan: hapus cache lama yang masih menyimpan data dummy versi lama
if (typeof localStorage !== 'undefined') localStorage.removeItem('binpres-admin-db');

export const ui = $state({ loaded: false, toast: '', refreshing: false });

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function notify(msg: string) {
  ui.toast = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (ui.toast = ''), 2500);
}

// Tarik data dari backend; dipakai saat init & setelah tiap mutasi
let inflight: Promise<void> | null = null;

export async function refresh() {
  if (typeof fetch === 'undefined') return;
  if (inflight) return inflight; // dedup: panggilan bersamaan share satu request
  ui.refreshing = true;
  inflight = doRefresh().finally(() => {
    inflight = null;
    ui.refreshing = false;
  });
  return inflight;
}

async function doRefresh() {
  try {
    // login → data lengkap (RBAC by token); tamu → ringkasan publik (landing)
    const path = auth.user ? '/api/sheets/all' : '/api/public/summary';
    const j = await api(path);
    if (j.ok) {
      const data = j.data as Record<string, Row[]>;
      db.sections.forEach((s) => {
        const rows = data[SHEET[s.id] ?? s.id] ?? [];
        s.rows = rows;
      });
      syncLabels();
    }
  } catch {
    /* offline: biarkan data lokal */
  } finally {
    ui.loaded = true;
  }
}

export async function addRow(sectionId: string, row: Row) {
  const r = await api(`/api/${SHEET[sectionId] ?? sectionId}`, { method: 'POST', body: JSON.stringify(row) });
  if (r.ok) {
    notify('Data berhasil ditambahkan');
    await refresh();
  }
  return r;
}

export async function updateRow(sectionId: string, id: string, data: Row) {
  const r = await api(`/api/${SHEET[sectionId] ?? sectionId}/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  if (r.ok) {
    notify('Data berhasil diperbarui');
    await refresh();
  }
  return r;
}

export async function deleteRow(sectionId: string, id: string) {
  const r = await api(`/api/${SHEET[sectionId] ?? sectionId}/${id}`, { method: 'DELETE' });
  if (r.ok) {
    notify('Data berhasil dihapus');
    await refresh();
  }
  return r;
}

// hapus berkas hasil upload di server (tombol Hapus di UploadField utk file sesi ini)
export async function deleteUpload(url: string) {
  return api('/api/upload', { method: 'DELETE', body: JSON.stringify({ url }) });
}

// Unggah gambar/PDF (maks 3MB di server) → { ok, url }
export async function uploadFile(file: File): Promise<{ ok: boolean; url?: string; error?: string }> {
  const fd = new FormData();
  fd.append('file', file);
  try {
    const res = await fetch(`${API}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    return await res.json();
  } catch {
    return { ok: false, error: 'Gagal mengunggah berkas' };
  }
}

export type User = { nama: string; username: string; cabor: string; role: string };

function loadUser(): User | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('binpres-user') || 'null');
  } catch {
    return null;
  }
}

export const auth = $state<{ user: User | null }>({ user: loadUser() });

export async function login(username: string, password: string): Promise<string | null> {
  try {
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    if (!r.ok) return r.error ?? 'Login gagal';
    if (!r.token) return 'Login gagal: token tidak diterima';
    token = r.token;
    auth.user = { nama: r.user.nama, username: r.user.username, cabor: r.user.cabor, role: r.user.role };
    localStorage.setItem('binpres-token', token!);
    localStorage.setItem('binpres-user', JSON.stringify(auth.user));
    syncLabels();
    await refresh(); // setelah login tarik data lengkap (sebelumnya hanya ringkasan publik)
  } catch {
    return 'Tidak dapat terhubung ke server';
  }
  return null;
}

export function logout() {
  clearSession();
  // CSS anti-flash bergantung pada atribut ini — hapus agar login terlihat lagi
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-auth');
  refresh(); // kembali ke ringkasan publik
}

// Label section klub menyesuaikan cabor user yang login
export function clubLabel(cabor: string): string {
  if (cabor === 'Pencak Silat') return 'Perguruan';
  if (cabor === 'Taekwondo' || cabor === 'Karate') return 'Dojang';
  return 'Klub';
}

export function syncLabels() {
  const k = db.sections.find((s) => s.id === 'klub');
  if (!k) return;
  k.label = !auth.user || auth.user.cabor === 'Semua'
    ? 'Nama Klub/Dojang/Perguruan'
    : 'Tambah ' + clubLabel(auth.user.cabor);
}
syncLabels();

if (typeof window !== 'undefined') refresh();
