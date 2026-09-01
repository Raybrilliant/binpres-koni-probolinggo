<script lang="ts">
  import { onMount } from 'svelte';
  import { db, addRow, updateRow, fetchRow, auth, PERIODE, type Row } from '../lib/store.svelte';
  import CaborCombobox from './CaborCombobox.svelte';
  import UploadField from './UploadField.svelte';
  import gsap from 'gsap';

  // dipakai inline di AdminDashboard: section + editId dari props, onDone dipanggil setelah simpan sukses
  let {
    section,
    editId = null,
    onDone = null,
  }: {
    section: string;
    editId?: number | string | null;
    onDone?: (() => void) | null;
  } = $props();

  const isEdit = $derived(editId !== null);
  let ready = $state(false);

  const active = $derived(db.sections.find((s) => s.id === section));
  const YEARS = ['2026', '2025', '2024'];
  const TINGKAT = ['Provinsi', 'Nasional', 'Internasional'];

  let atlit = $state({
    nama: '', tempatLahir: '', tanggalLahir: '', jenisKelamin: 'Laki-laki', alamat: '', cabor: '', proyeksiPorprov: 'Tidak',
  });
  let prestasi = $state([{ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' }]);
  let files = $state<{ kk: string; akte: string; ktp: string }>({ kk: '', akte: '', ktp: '' });

  let pelatih = $state({ nama: '', alamat: '', jenisKelamin: 'Laki-laki', lisensi: '', fileLisensi: '', cabor: '' });
  let jadwal = $state({ tempat: '', cabor: '', hariMulai: 'Senin', hariSelesai: 'Senin', jamMulai: '', jamSelesai: '' });
  let medali = $state({ cabor: '', periode: '', targetEmas: 0, targetPerak: 0, targetPerunggu: 0, hasilEmas: 0, hasilPerak: 0, hasilPerunggu: 0 });
  let pengurus = $state({ nama: '', jabatan: '', bio: '', foto: '' });
  let generic: Row = $state({ cabor: 'Semua', role: 'Operator', username: '' });
  let busy = $state(false);
  let saveError = $state('');

  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!active || busy) return;
    busy = true;
    saveError = '';
    // validasi manual berkas wajib — input file tidak bisa pakai required native
    // karena nilainya URL hasil upload, bukan File (browser cek input.files)
    const missing: string[] = [];
    if (section === 'atlit') {
      if (!files.kk) missing.push('Kartu Keluarga (KK)');
      if (!files.akte) missing.push('Akte Kelahiran');
      const idx = prestasi.findIndex((p) => !p.piagam);
      if (idx !== -1) missing.push(`Piagam prestasi #${idx + 1}`);
    }
    if (section === 'pelatih' && !pelatih.fileLisensi) missing.push('File Lisensi');
    if (missing.length) {
      saveError = 'Wajib unggah: ' + missing.join(', ');
      busy = false;
      return;
    }
    try {
      let r: { ok: boolean; error?: string };
      if (isEdit) {
        r = await updateRow(section, String(editId), collect());
      } else {
        r = await addRow(section === 'atlit' ? 'atlit' : section === 'pelatih' ? 'pelatih' : section === 'jadwal' ? 'jadwal' : section, collect());
      }
      if (!r.ok) {
        saveError = r.error ?? 'Gagal menyimpan data';
        return;
      }
      // toast sudah ditampilkan store; kembali ke daftar tanpa reload halaman
      onDone?.();
    } finally {
      busy = false;
    }
  }

  // operator non-admin: data yang dibuat selalu milik cabor-nya
  const opCabor = $derived(auth.user && auth.user.cabor !== 'Semua' ? auth.user.cabor : '');

  function collect(): Row {
    if (section === 'atlit') {
      const o = { ...atlit, ...files, prestasi: prestasi.map((p) => ({ ...p })) };
      if (opCabor) o.cabor = opCabor;
      return o;
    }
    if (section === 'pelatih') {
      const o = { ...pelatih };
      if (opCabor) o.cabor = opCabor;
      return o;
    }
    if (section === 'jadwal') {
      // kolom sheet tetap 'hari' & 'jam', diisi gabungan rentang: "Senin - Sabtu", "16:00 - 18:00"
      const hari = jadwal.hariSelesai && jadwal.hariSelesai !== jadwal.hariMulai ? `${jadwal.hariMulai} - ${jadwal.hariSelesai}` : jadwal.hariMulai;
      const jam = jadwal.jamSelesai ? `${jadwal.jamMulai} - ${jadwal.jamSelesai}` : jadwal.jamMulai;
      const cabor = opCabor || jadwal.cabor;
      return { tempat: jadwal.tempat, cabor, hari, jam };
    }
    if (section === 'medali') {
      const num = (v: unknown) => Number(v) || 0;
      return {
        cabor: opCabor || medali.cabor,
        periode: medali.periode,
        targetEmas: num(medali.targetEmas),
        targetPerak: num(medali.targetPerak),
        targetPerunggu: num(medali.targetPerunggu),
        hasilEmas: num(medali.hasilEmas),
        hasilPerak: num(medali.hasilPerak),
        hasilPerunggu: num(medali.hasilPerunggu),
      };
    }
    if (section === 'pengurus') return { ...pengurus };
    if (section === 'users') return { ...generic };
    // section generik (klub/dll): hanya kirim field milik section ini
    const o: Row = {};
    active?.fields.forEach((f) => (o[f.key] = generic[f.key] ?? ''));
    return o;
  }

  // Prefill form dari server (GET /api/{section}/:id) saat mode edit
  async function fill() {
    if (!isEdit) return;
    try {
      const row = await fetchRow(section, editId!);
      if (!row) return;
    if (section === 'atlit') {
      Object.assign(atlit, {
        nama: row.nama ?? '', tempatLahir: row.tempatLahir ?? '',
        tanggalLahir: String(row.tanggalLahir ?? '').slice(0, 10),
        jenisKelamin: row.jenisKelamin ?? 'Laki-laki', alamat: row.alamat ?? '',
        cabor: String(row.cabor ?? ''),
        proyeksiPorprov: String(row.proyeksiPorprov ?? '') || 'Tidak',
      });
      prestasi.length = 0;
      const list = row.prestasi?.length ? row.prestasi : [{ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' }];
      list.forEach((p: any) =>
        prestasi.push({
          nama: String(p.nama ?? ''),
          tahun: String(p.tahun ?? '2026'), // tahun dari sheet = angka; select butuh string
          tingkat: String(p.tingkat ?? 'Provinsi'),
          piagam: String(p.piagam ?? ''),
        })
      );
      Object.assign(files, { kk: row.kk ?? '', akte: row.akte ?? '', ktp: row.ktp ?? '' });
    } else if (section === 'pelatih') {
      Object.assign(pelatih, { nama: row.nama ?? '', alamat: row.alamat ?? '', jenisKelamin: row.jenisKelamin ?? 'Laki-laki', lisensi: row.lisensi ?? '', fileLisensi: row.fileLisensi ?? '', cabor: String(row.cabor ?? '') });
    } else if (section === 'jadwal') {
      const [hariMulai = 'Senin', hariSelesai = ''] = String(row.hari ?? 'Senin').split(' - ');
      const [jamMulai = '', jamSelesai = ''] = String(row.jam ?? '').split(' - ');
      Object.assign(jadwal, { tempat: row.tempat ?? '', cabor: String(row.cabor ?? ''), hariMulai, hariSelesai: hariSelesai || hariMulai, jamMulai, jamSelesai });
    } else if (section === 'medali') {
      Object.assign(medali, {
        cabor: String(row.cabor ?? ''),
        periode: String(row.periode ?? ''),
        targetEmas: Number(row.targetEmas) || 0,
        targetPerak: Number(row.targetPerak) || 0,
        targetPerunggu: Number(row.targetPerunggu) || 0,
        hasilEmas: Number(row.hasilEmas) || 0,
        hasilPerak: Number(row.hasilPerak) || 0,
        hasilPerunggu: Number(row.hasilPerunggu) || 0,
      });
    } else if (section === 'pengurus') {
      Object.assign(pengurus, { nama: row.nama ?? '', jabatan: row.jabatan ?? '', bio: row.bio ?? '', foto: row.foto ?? '' });
    } else {
      active?.fields.forEach((f) => (generic[f.key] = row[f.key] ?? ''));
    }
    } finally {
      ready = true;
    }
  }

  onMount(() => {
    fill().then(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.form-card', { y: 28, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
        gsap.from('.form-field', { y: 16, autoAlpha: 0, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.15, clearProps: 'all' });
      });
      return () => mm.revert();
    });
  });
</script>

<div class="mx-auto max-w-3xl p-6 lg:p-8">
  <div class="mb-6 flex items-center gap-3">
    <button type="button" class="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow ring-1 ring-gray-100 transition hover:bg-blue-50 active:scale-95" onclick={() => onDone?.()}>← Kembali</button>
    <h1 class="text-2xl font-bold">{active?.icon ?? '📄'} {isEdit ? 'Edit' : 'Tambah'} {active?.label ?? 'Data'}</h1>
  </div>

  {#if isEdit && !ready}
    <div class="form-card flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-100">
      <div class="h-5 w-40 animate-pulse rounded bg-gray-200"></div>
      {#each Array(4) as _, i (i)}
        <div>
          <div class="mb-2 h-3.5 w-28 animate-pulse rounded bg-gray-100"></div>
          <div class="h-10 w-full animate-pulse rounded-xl bg-gray-100"></div>
        </div>
      {/each}
      <p class="text-center text-xs text-gray-400">Memuat data dari server...</p>
    </div>
  {:else}
  <form onsubmit={submit} class="form-card flex flex-col gap-5 rounded-2xl bg-white p-6 shadow-lg ring-1 ring-gray-100">
    {#if section === 'atlit'}
      <p class="text-xs font-semibold uppercase tracking-widest text-blue-500">Data Diri</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Lengkap *</span>
          <input required bind:value={atlit.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tempat Lahir *</span>
          <input required bind:value={atlit.tempatLahir} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tanggal Lahir *</span>
          <input required type="date" bind:value={atlit.tanggalLahir} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jenis Kelamin *</span>
          <select bind:value={atlit.jenisKelamin} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option>Laki-laki</option><option>Perempuan</option>
          </select></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Atlit Proyeksi Porprov X</span>
          <select bind:value={atlit.proyeksiPorprov} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
            <option>Tidak</option><option>Ya</option>
          </select></label>
      </div>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        {#if opCabor}
          <input type="text" value={opCabor} disabled class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 outline-none" />
        {:else}
          <CaborCombobox bind:value={atlit.cabor} pinned={null} allowCustom />
        {/if}</label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Alamat *</span>
        <textarea required rows="2" bind:value={atlit.alamat} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"></textarea></label>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-blue-500">Prestasi Terbaik (min. tingkat Provinsi, 2 tahun terakhir)</p>
      {#each prestasi as p, i (i)}
        <div class="form-field grid gap-3 rounded-xl bg-blue-50/60 p-4 sm:grid-cols-[1fr_auto]">
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Prestasi *</span>
              <input required bind:value={p.nama} class="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-blue-400" /></label>
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Tahun *</span>
              <select bind:value={p.tahun} class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400">
                {#each YEARS as y (y)}<option value={y}>{y}</option>{/each}
              </select></label>
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Tingkat *</span>
              <select bind:value={p.tingkat} class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400">
                {#each TINGKAT as t (t)}<option value={t}>{t}</option>{/each}
              </select></label>
            <label class="text-sm sm:col-span-3"><span class="mb-1 block font-medium text-gray-600">Piagam * <span class="font-normal text-gray-400">(gambar/PDF, maks 3MB)</span></span>
              <UploadField bind:value={p.piagam} /></label>
          </div>
          {#if prestasi.length > 1}
            <button type="button" class="self-start rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200" onclick={() => prestasi.splice(i, 1)}>🗑️</button>
          {/if}
        </div>
      {/each}
      <button type="button" class="self-start rounded-xl border-2 border-dashed border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50" onclick={() => prestasi.push({ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' })}>+ Tambah Prestasi</button>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-blue-500">Dokumen (unggah gambar/PDF, maks 3MB)</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Kartu Keluarga (KK) *</span>
          <UploadField bind:value={files.kk} /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Akte Kelahiran *</span>
          <UploadField bind:value={files.akte} /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">KTP <span class="font-normal text-gray-400">(jika sudah punya)</span></span>
          <UploadField bind:value={files.ktp} /></label>
      </div>

    {:else if section === 'pelatih'}
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Lengkap *</span>
          <input required bind:value={pelatih.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jenis Kelamin *</span>
          <select bind:value={pelatih.jenisKelamin} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400">
            <option>Laki-laki</option><option>Perempuan</option>
          </select></label>
      </div>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Alamat *</span>
        <textarea required rows="2" bind:value={pelatih.alamat} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"></textarea></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Lisensi Pelatih *</span>
        <input required bind:value={pelatih.lisensi} placeholder="cth: Lisensi Level 3" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        {#if opCabor}
          <input type="text" value={opCabor} disabled class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 outline-none" />
        {:else}
          <CaborCombobox bind:value={pelatih.cabor} pinned={null} allowCustom />
        {/if}</label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Lisensi Pelatih * <span class="font-normal text-gray-400">(gambar/PDF, maks 3MB)</span></span>
        <UploadField bind:value={pelatih.fileLisensi} /></label>

    {:else if section === 'jadwal'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tempat Latihan *</span>
        <input required bind:value={jadwal.tempat} placeholder="cth: GOR Sumber Taman" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        {#if opCabor}
          <input type="text" value={opCabor} disabled class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 outline-none" />
        {:else}
          <CaborCombobox bind:value={jadwal.cabor} pinned={null} allowCustom />
        {/if}</label>
      <div class="form-field grid gap-3 sm:grid-cols-2">
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Hari Mulai *</span>
          <select required bind:value={jadwal.hariMulai} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400">
            {#each HARI as h (h)}<option value={h}>{h}</option>{/each}
          </select></label>
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Hari Selesai *</span>
          <select required bind:value={jadwal.hariSelesai} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400">
            {#each HARI as h (h)}<option value={h}>{h}</option>{/each}
          </select></label>
      </div>
      <div class="form-field grid gap-3 sm:grid-cols-2">
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Jam Mulai *</span>
          <input required type="time" bind:value={jadwal.jamMulai} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Jam Selesai *</span>
          <input required type="time" bind:value={jadwal.jamSelesai} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      </div>

    {:else if section === 'medali'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        {#if opCabor}
          <input type="text" value={opCabor} disabled class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 outline-none" />
        {:else}
          <CaborCombobox bind:value={medali.cabor} pinned={null} allowCustom />
        {/if}</label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Periode * <span class="font-normal text-gray-400">(PORPROV tiap 2 tahun)</span></span>
        <select required bind:value={medali.periode} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
          <option value="" disabled>Pilih periode</option>
          {#if isEdit && medali.periode && !PERIODE.includes(medali.periode)}<option value={medali.periode}>{medali.periode}</option>{/if}
          {#each PERIODE as p (p)}<option value={p}>{p}</option>{/each}
        </select></label>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-blue-500">1. Target Medali <span class="font-normal normal-case text-gray-400">— diisi minggu pertama Januari 2027</span></p>
      <div class="form-field grid gap-3 sm:grid-cols-3">
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥇 Emas</span>
          <input required type="number" min="0" bind:value={medali.targetEmas} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥈 Perak</span>
          <input required type="number" min="0" bind:value={medali.targetPerak} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥉 Perunggu</span>
          <input required type="number" min="0" bind:value={medali.targetPerunggu} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      </div>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-blue-500">2. Perolehan Medali <span class="font-normal normal-case text-gray-400">— diisi setelah PORPROV X selesai</span></p>
      {#if isEdit}
        <div class="form-field grid gap-3 sm:grid-cols-3">
          <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥇 Emas</span>
            <input required type="number" min="0" bind:value={medali.hasilEmas} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥈 Perak</span>
            <input required type="number" min="0" bind:value={medali.hasilPerak} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
          <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">🥉 Perunggu</span>
            <input required type="number" min="0" bind:value={medali.hasilPerunggu} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
        </div>
      {:else}
        <p class="rounded-xl bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-gray-500">Perolehan medali dapat diisi setelah target tersimpan — buka daftar lalu klik tombol <b>🏅 Perolehan</b> pada baris cabor ini.</p>
      {/if}

    {:else if section === 'pengurus'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama *</span>
        <input required bind:value={pengurus.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jabatan *</span>
        <input required bind:value={pengurus.jabatan} placeholder="cth: Ketua Bidang Pembinaan" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Biodata *</span>
        <textarea required rows="4" bind:value={pengurus.bio} placeholder="1 paragraf biodata pengurus..." class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"></textarea></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">URL Foto <span class="font-normal text-gray-400">(gambar, maks 3MB — kosongkan untuk default)</span></span>
        <UploadField bind:value={pengurus.foto} accept="image/jpeg,image/png,image/webp" placeholder="Pilih foto pengurus (maks 3MB)" /></label>

    {:else if section === 'users'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama *</span>
        <input required bind:value={generic.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Username *</span>
        <input required bind:value={generic.username} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        <CaborCombobox bind:value={generic.cabor} /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Password {#if isEdit}<span class="font-normal text-gray-400">(kosongkan jika tidak diubah)</span>{/if} *</span>
        <input required={!isEdit} minlength={6} type="password" bind:value={generic.password} placeholder={isEdit ? '••••••••' : ''} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Role *</span>
        <select bind:value={generic.role} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
          {#each ['Super Admin', 'Admin', 'Operator'] as r (r)}<option value={r}>{r}</option>{/each}
        </select></label>

    {:else if active}
      {#each active.fields as f (f.key)}
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">{f.label} *</span>
          {#if f.key === 'cabang'}
            <CaborCombobox bind:value={generic[f.key]} pinned={null} allowCustom />
          {:else}
            <input required type={f.type ?? 'text'} placeholder={f.ph ?? ''} bind:value={generic[f.key]} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          {/if}</label>
      {/each}
    {:else}
      <p class="text-center text-gray-400">Section tidak ditemukan.</p>
    {/if}

    {#if saveError}<p class="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600">⚠️ {saveError}</p>{/if}
    {#if active}
      <div class="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <button type="button" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100" onclick={() => onDone?.()}>Batal</button>
        <button type="submit" disabled={busy} class="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {#if busy}<span class="spinner"></span> Menyimpan...{:else if isEdit}💾 Update{:else}💾 Simpan{/if}
        </button>
      </div>
    {/if}
  </form>
  {/if}
</div>
