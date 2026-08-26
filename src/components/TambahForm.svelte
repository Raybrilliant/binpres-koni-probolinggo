<script lang="ts">
  import { onMount } from 'svelte';
  import { db, addRow, updateRow, refresh, save, ui, type Row } from '../lib/store.svelte';
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
    nama: '', tempatLahir: '', tanggalLahir: '', jenisKelamin: 'Laki-laki', alamat: '',
  });
  let prestasi = $state([{ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' }]);
  let files = $state<{ kk: string; akte: string; ktp: string }>({ kk: '', akte: '', ktp: '' });

  let pelatih = $state({ nama: '', alamat: '', jenisKelamin: 'Laki-laki', lisensi: '', fileLisensi: '' });
  let jadwal = $state({ tempat: '', hari: 'Senin', jam: '' });
  let generic: Row = $state({ cabor: 'Semua', role: 'Operator', username: '' });
  let busy = $state(false);

  const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const CABOR = ['Taekwondo', 'Karate', 'Pencak Silat', 'Sepak Bola', 'Bola Voli', 'Renang', 'Atletik'];
  // sertakan nilai lama agar dropdown tidak "hilang" saat data dari server di luar daftar
  const caborOptions = $derived(
    generic.cabor && generic.cabor !== 'Semua' && !CABOR.includes(generic.cabor)
      ? [...CABOR, generic.cabor]
      : CABOR
  );

  function fileName(e: Event): string {
    const f = (e.target as HTMLInputElement).files?.[0];
    return f ? f.name : '';
  }

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
          save();
        }
      } else {
        await addRow(section === 'atlit' ? 'atlit' : section === 'pelatih' ? 'pelatih' : section === 'jadwal' ? 'jadwal' : section, collect());
      }
      location.href = '/admin#' + section;
    } finally {
      busy = false;
    }
  }

  function collect(): Row {
    if (section === 'atlit') return { ...atlit, ...files, prestasi: prestasi.map((p) => ({ ...p })) };
    if (section === 'pelatih') return { ...pelatih };
    if (section === 'jadwal') return { ...jadwal };
    return { ...generic };
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
      });
      prestasi.length = 0;
      const list = row.prestasi?.length ? row.prestasi : [{ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' }];
      list.forEach((p: any) => prestasi.push({ ...p }));
      Object.assign(files, { kk: row.kk ?? '', akte: row.akte ?? '', ktp: row.ktp ?? '' });
    } else if (section === 'pelatih') {
      Object.assign(pelatih, { nama: row.nama ?? '', alamat: row.alamat ?? '', jenisKelamin: row.jenisKelamin ?? 'Laki-laki', lisensi: row.lisensi ?? '', fileLisensi: row.fileLisensi ?? '' });
    } else if (section === 'jadwal') {
      Object.assign(jadwal, { tempat: row.tempat ?? '', hari: row.hari ?? 'Senin', jam: String(row.jam ?? '') });
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
        gsap.from('.form-field', { y: 16, autoAlpha: 0, duration: 0.35, ease: 'power2.out', stagger: 0.05, delay: 0.15 });
      });
      return () => mm.revert();
    });
  });
</script>

<div class="mx-auto max-w-3xl p-6 lg:p-8">
  <div class="mb-6 flex items-center gap-3">
    <a href="/admin#{section}" class="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow ring-1 ring-gray-100 transition hover:bg-red-50 active:scale-95">← Kembali</a>
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
      <p class="text-xs font-semibold uppercase tracking-widest text-red-500">Data Diri</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Lengkap *</span>
          <input required bind:value={atlit.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tempat Lahir *</span>
          <input required bind:value={atlit.tempatLahir} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tanggal Lahir *</span>
          <input required type="date" bind:value={atlit.tanggalLahir} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jenis Kelamin *</span>
          <select bind:value={atlit.jenisKelamin} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100">
            <option>Laki-laki</option><option>Perempuan</option>
          </select></label>
      </div>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Alamat *</span>
        <textarea required rows="2" bind:value={atlit.alamat} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"></textarea></label>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-red-500">Prestasi Terbaik (min. tingkat Provinsi, 2 tahun terakhir)</p>
      {#each prestasi as p, i (i)}
        <div class="form-field grid gap-3 rounded-xl bg-red-50/60 p-4 sm:grid-cols-[1fr_auto]">
          <div class="grid gap-3 sm:grid-cols-3">
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Prestasi *</span>
              <input required bind:value={p.nama} class="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-red-400" /></label>
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Tahun *</span>
              <select bind:value={p.tahun} class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400">
                {#each YEARS as y (y)}<option value={y}>{y}</option>{/each}
              </select></label>
            <label class="text-sm"><span class="mb-1 block font-medium text-gray-600">Tingkat *</span>
              <select bind:value={p.tingkat} class="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400">
                {#each TINGKAT as t (t)}<option value={t}>{t}</option>{/each}
              </select></label>
            <label class="text-sm sm:col-span-3"><span class="mb-1 block font-medium text-gray-600">Upload Piagam * (PDF/JPG)</span>
              <input required={!(editId || editIndex !== null) || !p.piagam} type="file" accept=".pdf,.jpg,.jpeg,.png"
                onchange={(e) => (p.piagam = fileName(e))}
                class="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
              {#if p.piagam}<span class="mt-1 block text-xs text-red-600">📎 {p.piagam}</span>{/if}</label>
          </div>
          {#if prestasi.length > 1}
            <button type="button" class="self-start rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200" onclick={() => prestasi.splice(i, 1)}>🗑️</button>
          {/if}
        </div>
      {/each}
      <button type="button" class="self-start rounded-xl border-2 border-dashed border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50" onclick={() => prestasi.push({ nama: '', tahun: '2026', tingkat: 'Provinsi', piagam: '' })}>+ Tambah Prestasi</button>

      <p class="mt-2 text-xs font-semibold uppercase tracking-widest text-red-500">Upload Dokumen</p>
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Kartu Keluarga (KK) *</span>
          <input required={!(editId || editIndex !== null) || !files.kk} type="file" accept=".pdf,.jpg,.jpeg,.png" onchange={(e) => (files.kk = fileName(e))}
            class="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
          {#if files.kk}<span class="mt-1 block text-xs text-red-600">📎 {files.kk}</span>{/if}</label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Akte Kelahiran *</span>
          <input required={!(editId || editIndex !== null) || !files.akte} type="file" accept=".pdf,.jpg,.jpeg,.png" onchange={(e) => (files.akte = fileName(e))}
            class="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
          {#if files.akte}<span class="mt-1 block text-xs text-red-600">📎 {files.akte}</span>{/if}</label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">KTP <span class="font-normal text-gray-400">(jika sudah punya)</span></span>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onchange={(e) => (files.ktp = fileName(e))}
            class="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
          {#if files.ktp}<span class="mt-1 block text-xs text-red-600">📎 {files.ktp}</span>{/if}</label>
      </div>

    {:else if section === 'pelatih'}
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama Lengkap *</span>
          <input required bind:value={pelatih.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jenis Kelamin *</span>
          <select bind:value={pelatih.jenisKelamin} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400">
            <option>Laki-laki</option><option>Perempuan</option>
          </select></label>
      </div>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Alamat *</span>
        <textarea required rows="2" bind:value={pelatih.alamat} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"></textarea></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Lisensi Pelatih *</span>
        <input required bind:value={pelatih.lisensi} placeholder="cth: Lisensi Level 3" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Upload Lisensi Pelatih * (PDF/JPG)</span>
        <input required={!(editId || editIndex !== null) || !pelatih.fileLisensi} type="file" accept=".pdf,.jpg,.jpeg,.png" onchange={(e) => (pelatih.fileLisensi = fileName(e))}
          class="w-full rounded-xl border border-gray-200 px-3 py-1.5 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-red-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" />
        {#if pelatih.fileLisensi}<span class="mt-1 block text-xs text-red-600">📎 {pelatih.fileLisensi}</span>{/if}</label>

    {:else if section === 'jadwal'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Tempat Latihan *</span>
        <input required bind:value={jadwal.tempat} placeholder="cth: GOR Sumber Taman" class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Hari Latihan *</span>
        <select bind:value={jadwal.hari} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400">
          {#each HARI as h (h)}<option value={h}>{h}</option>{/each}
        </select></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Jam Latihan *</span>
        <input required type="time" bind:value={jadwal.jam} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>

    {:else if section === 'users'}
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Nama *</span>
        <input required bind:value={generic.nama} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Username *</span>
        <input required bind:value={generic.username} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Cabang Olahraga *</span>
        <select bind:value={generic.cabor} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100">
          <option value="Semua">Semua (khusus Admin)</option>
          {#each caborOptions as c (c)}<option value={c}>{c}</option>{/each}
        </select></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Password {#if isEdit}<span class="font-normal text-gray-400">(kosongkan jika tidak diubah)</span>{/if} *</span>
        <input required={!isEdit} minlength={6} type="password" bind:value={generic.password} placeholder={isEdit ? '••••••••' : ''} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">Role *</span>
        <select bind:value={generic.role} class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100">
          {#each ['Super Admin', 'Admin', 'Operator'] as r (r)}<option value={r}>{r}</option>{/each}
        </select></label>

    {:else if active}
      {#each active.fields as f (f.key)}
        <label class="form-field text-sm"><span class="mb-1 block font-medium text-gray-600">{f.label} *</span>
          <input required type={f.type ?? 'text'} bind:value={generic[f.key]} class="w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" /></label>
      {/each}
    {:else}
      <p class="text-center text-gray-400">Section tidak ditemukan.</p>
    {/if}

    {#if active}
      <div class="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4">
        <a href="/admin#{section}" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100">Batal</a>
        <button type="submit" disabled={busy} class="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {#if busy}<span class="spinner"></span> Menyimpan...{:else if editId || editIndex !== null}💾 Update{:else}💾 Simpan{/if}
        </button>
      </div>
    {/if}
  </form>
  {/if}
</div>
