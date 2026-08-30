<script lang="ts">
  import { onMount } from 'svelte';
  import { db, addRow, updateRow, refresh, ui, auth, type Row } from '../lib/store.svelte';
  import CaborCombobox from './CaborCombobox.svelte';
  import gsap from 'gsap';

  let { section }: { section: string } = $props();

  const editId = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('id') : null;
  const editIndex = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('index') : null;
  const isEdit = editId !== null || editIndex !== null;
  let ready = $state(!isEdit);

  const active = $derived(db.sections.find((s) => s.id === section));
  const YEARS = ['2026', '2025', '2024'];
  const TINGKAT = ['Provinsi', 'Nasional', 'Internasional'];

  let atlit = $state({
    nama: '', tempatLahir: '', tanggalLahir: '', jenisKelamin: 'Laki-laki', alamat: '', cabor: '', proyeksiPorprov: 'Tidak',
  });
  let prestasi = $state([{ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' }]);
  let files = $state<{ kk: string; akte: string; ktp: string }>({ kk: '', akte: '', ktp: '' });

  let pelatih = $state({ nama: '', alamat: '', jenisKelamin: 'Laki-laki', lisensi: '', fileLisensi: '', cabor: '' });
  let jadwal = $state({ tempat: '', hariMulai: 'Senin', hariSelesai: 'Senin', jamMulai: '', jamSelesai: '' });
  let pengurus = $state({ nama: '', jabatan: '', bio: '', foto: '' });
  let generic: Row = $state({ cabor: 'Semua', role: 'Operator', username: '' });
  let busy = $state(false);

  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!active || busy) return;
    busy = true;
    try {
      if (editId || editIndex !== null) {
        const target = findRow();
        if (target?.id) {
          await updateRow(section, target.id, collect());
        } else if (target) {
          Object.assign(target, collect());
        }
      } else {
        await addRow(section === 'atlit' ? 'atlit' : section === 'pelatih' ? 'pelatih' : section === 'jadwal' ? 'jadwal' : section, collect());
      }
      location.href = '/admin#' + section;
    } finally {
      busy = false;
    }
  }

  // semua "upload" diisi link Google Drive; divalidasi browser (pattern) dan server (Code.gs)
  const DRIVE_RX = 'https://(drive|docs)\\.google\\.com/.+';

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
      return { tempat: jadwal.tempat, hari, jam };
    }
    if (section === 'pengurus') return { ...pengurus };
    if (section === 'users') return { ...generic };
    // section generik (klub/dll): hanya kirim field milik section ini
    const o: Row = {};
    active?.fields.forEach((f) => (o[f.key] = generic[f.key] ?? ''));
    return o;
  }

  function findRow(): Row | null {
    const rows = db.sections.find((x) => x.id === section)?.rows ?? [];
    if (editId) return rows.find((r) => r.id === editId) ?? null;
    if (editIndex !== null) return rows[Number(editIndex)] ?? null;
    return null;
  }

  // Prefill form dari data existing saat mode edit
  async function fill() {
    if (!isEdit) return;
    try {
      if (!ui.loaded) await refresh();
      const row = findRow();
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
      Object.assign(jadwal, { tempat: row.tempat ?? '', hariMulai, hariSelesai: hariSelesai || hariMulai, jamMulai, jamSelesai });
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
    <a href="/admin#{section}" class="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 shadow ring-1 ring-gray-100 transition hover:bg-blue-50 active:scale-95">← Kembali</a>
    <h1 class="text-2xl font-bold">{active?.icon ?? '📄'} {editId || editIndex !== null ? 'Edit' : 'Tambah'} {active?.label ?? 'Data'}</h1>
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
            <label class="text-sm sm:col-span-3"><span class="mb-1 block font-medium text-gray-600">Piagam * <span class="font-normal text-gray-400">(link Google Drive)</span></span>
              <input required bind:value={p.piagam} type="url" placeholder="https://drive.google.com/file/d/..." title="Harus link Google Drive"
                pattern={DRIVE_RX}
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              {#if p.piagam}<a href={p.piagam} target="_blank" rel="noopener" class="mt-1 inline-block truncate text-xs font-medium text-blue-600 hover:text-blue-800">📎 Cek link</a>{/if}</label>
          </div>
          {#if prestasi.length > 1}
            <button type="button" class="self-start rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200" onclick={() => prestasi.splice(i, 1)}>🗑️</button>
          {/if}
        </div>
      {/each}
      <button type="button" class="self-start rounded-xl border-2 border-dashed border-blue-300 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50" onclick={() => prestasi.push({ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' })}>+ Tambah Prestasi</button>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-blue-500">Dokumen (tempel link Google Drive)</p>
      <p class="text-[11px] text-gray-400">Di Drive: klik kanan berkas → <b>Bagikan</b> → <b>Siapa saja yang memiliki link</b> → salin tautannya ke sini.</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Kartu Keluarga (KK) *</span>
          <input required={!(editId || editIndex !== null) || !files.kk} type="url" bind:value={files.kk} placeholder="https://drive.google.com/..." title="Harus link Google Drive" pattern={DRIVE_RX}
            class="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          {#if files.kk}<a href={files.kk} target="_blank" rel="noopener" class="mt-1 inline-block truncate text-xs font-medium text-blue-600 hover:text-blue-800">📎 Cek link</a>{/if}</label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Akte Kelahiran *</span>
          <input required={!(editId || editIndex !== null) || !files.akte} type="url" bind:value={files.akte} placeholder="https://drive.google.com/..." title="Harus link Google Drive" pattern={DRIVE_RX}
            class="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          {#if files.akte}<a href={files.akte} target="_blank" rel="noopener" class="mt-1 inline-block truncate text-xs font-medium text-blue-600 hover:text-blue-800">📎 Cek link</a>{/if}</label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">KTP <span class="font-normal text-gray-400">(jika sudah punya)</span></span>
          <input type="url" bind:value={files.ktp} placeholder="https://drive.google.com/..." title="Harus link Google Drive" pattern={DRIVE_RX}
            class="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
          {#if files.ktp}<a href={files.ktp} target="_blank" rel="noopener" class="mt-1 inline-block truncate text-xs font-medium text-blue-600 hover:text-blue-800">📎 Cek link</a>{/if}</label>
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
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Lisensi Pelatih * <span class="font-normal text-gray-400">(link Google Drive)</span></span>
        <input required bind:value={pelatih.fileLisensi} type="url" placeholder="https://drive.google.com/file/d/..." title="Harus link Google Drive" pattern={DRIVE_RX}
          class="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        {#if pelatih.fileLisensi}<a href={pelatih.fileLisensi} target="_blank" rel="noopener" class="mt-1 inline-block truncate text-xs font-medium text-blue-600 hover:text-blue-800">📎 Cek link</a>{/if}</label>

    {:else if section === 'jadwal'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tempat Latihan *</span>
        <input required bind:value={jadwal.tempat} placeholder="cth: GOR Sumber Taman" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
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

    {:else if section === 'pengurus'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama *</span>
        <input required bind:value={pengurus.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jabatan *</span>
        <input required bind:value={pengurus.jabatan} placeholder="cth: Ketua Bidang Pembinaan" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Biodata *</span>
        <textarea required rows="4" bind:value={pengurus.bio} placeholder="1 paragraf biodata pengurus..." class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"></textarea></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">URL Foto <span class="font-normal text-gray-400">(Google Drive)</span></span>
        <input type="url" bind:value={pengurus.foto} placeholder="https://drive.google.com/... (kosongkan untuk default)" title="Harus link Google Drive" pattern={DRIVE_RX} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>

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

    {#if active}
      <div class="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <a href="/admin#{section}" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100">Batal</a>
        <button type="submit" disabled={busy} class="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {#if busy}<span class="spinner"></span> Menyimpan...{:else if editId || editIndex !== null}💾 Update{:else}💾 Simpan{/if}
        </button>
      </div>
    {/if}
  </form>
  {/if}
</div>
