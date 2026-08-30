export type Row = Record<string, any>;
export type Field = { key: string; label: string; type?: string; ph?: string };
export type Section = { id: string; label: string; icon: string; fields: Field[]; rows: Row[] };

// cabang olahraga binaan KONI Kota Probolinggo (sesuai data resmi)
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

// Astro static site: hanya env ber-prefix PUBLIC_ yang sampai ke client
const ENDPOINT: string = (import.meta.env.PUBLIC_GAS_ENDPOINT || import.meta.env.GAS_ENDPOINT || '') as string;

// mapping id section frontend → nama sheet di spreadsheet
const SHEET: Record<string, string> = {
  atlit: 'atlit',
  pelatih: 'pelatih',
  jadwal: 'jadwal_latihan',
  klub: 'klub/dojang/perguruan',
  users: 'users',
  pengurus: 'pengurus',
};

async function api(payload: any): Promise<any> {
  const res = await fetch(ENDPOINT, { method: 'POST', redirect: 'follow', body: JSON.stringify(payload) });
  return res.json();
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
  // mode GAS: selalu mulai kosong, data diambil dari spreadsheet saat refresh()
  return seed().map((s) => ({ ...s, rows: [] }));
}

export const db = $state<{ sections: Section[] }>({ sections: loadLocal() });

// sekali jalan: hapus cache lama yang masih menyimpan data dummy versi lama
if (typeof localStorage !== 'undefined') localStorage.removeItem('binpres-admin-db');

export const ui = $state({ loaded: !ENDPOINT });

// Tarik semua data dari GAS; dipakai saat init & setelah tiap mutasi
let inflight: Promise<void> | null = null;

export async function refresh() {
  if (!ENDPOINT || typeof fetch === 'undefined') return;
  if (inflight) return inflight; // dedup: panggilan bersamaan share satu request
  inflight = doRefresh().finally(() => (inflight = null));
  return inflight;
}

async function doRefresh() {
  try {
    let data: Record<string, Row[]>;
    const res = await fetch(`${ENDPOINT}?sheet=all`);
    const j = await res.json();
    if (j.ok) {
      data = j.data;
    } else {
      // deployment lama belum dukung sheet=all: ambil per-sheet
      data = {};
      await Promise.all(
        db.sections.map(async (s) => {
          const r = await (await fetch(`${ENDPOINT}?sheet=${SHEET[s.id] ?? s.id}`)).json();
          data[s.id] = r.ok ? r.data : [];
        })
      );
    }
    db.sections.forEach((s) => (s.rows = data[SHEET[s.id] ?? s.id] ?? []));
    syncLabels();
  } catch {
    /* offline: biarkan data lokal */
  } finally {
    ui.loaded = true;
  }
}
if (typeof window !== 'undefined') refresh();



export async function addRow(sectionId: string, row: Row) {
  if (ENDPOINT) {
    // tandai pembuat data utk RBAC operator (backend membuang kolom ini di sheet tanpa createdBy)
    const r = await api({ action: 'create', sheet: SHEET[sectionId] ?? sectionId, actor: auth.user?.username, data: row });
    if (r.ok) await refresh();
    return r;
  }
  row.id = crypto.randomUUID();
  db.sections.find((s) => s.id === sectionId)?.rows.push(row);
  return { ok: true };
}

export async function updateRow(sectionId: string, id: string, data: Row) {
  if (ENDPOINT) {
    const r = await api({ action: 'update', sheet: SHEET[sectionId] ?? sectionId, id, data });
    if (r.ok) await refresh();
    return r;
  }
  const rows = db.sections.find((s) => s.id === sectionId)?.rows ?? [];
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows[i] = { ...rows[i], ...data };
  return { ok: true };
}

export async function deleteRow(sectionId: string, id: string) {
  if (ENDPOINT) {
    const r = await api({ action: 'delete', sheet: SHEET[sectionId] ?? sectionId, id });
    if (r.ok) await refresh();
    return r;
  }
  const s = db.sections.find((x) => x.id === sectionId);
  const i = s?.rows.findIndex((r) => r.id === id) ?? -1;
  if (i >= 0) s!.rows.splice(i, 1);
  return { ok: true };
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
  if (ENDPOINT) {
    try {
      const r = await api({ action: 'login', data: { username, password } });
      if (!r.ok) return r.error ?? 'Login gagal';
      auth.user = { nama: r.user.nama, username: r.user.username, cabor: r.user.cabor, role: r.user.role };
    } catch {
      return 'Tidak dapat terhubung ke server';
    }
  } else {
    const u = db.sections.find((s) => s.id === 'users')?.rows.find(
      (r) => String(r.username).toLowerCase() === username.toLowerCase()
    );
    if (!u) return 'Username tidak ditemukan';
    if (password.length < 6) return 'Password minimal 6 karakter';
    auth.user = { nama: u.nama, username: u.username, cabor: u.cabor, role: u.role };
  }
  localStorage.setItem('binpres-user', JSON.stringify(auth.user));
  syncLabels();
  return null;
}

export function logout() {
  auth.user = null;
  localStorage.removeItem('binpres-user');
  syncLabels();
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
