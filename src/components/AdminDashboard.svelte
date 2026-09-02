<script lang="ts">
  import type { Row } from '../lib/store.svelte';
  import { PERIODE } from '../lib/store.svelte';

  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { tick } from 'svelte';
  import gsap from 'gsap';
  import { db, auth, login, logout, deleteRow, ui, notify, list, stats, fetchList, fetchStats, fetchRow, PER_PAGE } from '../lib/store.svelte';
  import TambahForm from './TambahForm.svelte';

  // form tambah/edit inline (tanpa reload halaman)
  let form = $state<{ section: string; id: number | string | null } | null>(null);
  // render UI setelah tahu status sesi — SSR merender kosong agar login tidak pernah berkedip
  let hydrated = $state(false);

  const sections = db.sections;

  let view = $state(auth.user && auth.user.cabor !== 'Semua' ? 'atlit' : 'dashboard');
  let username = $state('');
  let password = $state('');
  let loginError = $state('');
  let busy = $state(false);

  async function doLogin(e: SubmitEvent) {
    e.preventDefault();
    if (busy) return;
    busy = true;
    loginError = (await login(username, password)) ?? '';
    busy = false;
    if (!loginError) {
      view = auth.user?.cabor === 'Semua' ? 'dashboard' : 'atlit';
      openView(view);
      // animasi sidebar hanya di desktop — di mobile sidebar dalam keadaan tertutup (drawer)
      if (matchMedia('(min-width: 1024px)').matches)
        gsap.from('.sidebar', { x: -60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      // tunggu elemen .login-error dirender dulu, baru dianimasikan
      tick().then(() => gsap.fromTo('.login-error', { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }));
    }
  }
  let openCabang = $state(true);
  let sidebarOpen = $state(false); // drawer menu di mobile
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  const isAdmin = $derived(!auth.user || auth.user.cabor === 'Semua');
  const menuSections = $derived(isAdmin ? sections : sections.filter((s) => !['users', 'pengurus'].includes(s.id)));

  const active = $derived(sections.find((s) => s.id === view));
  // non-admin: tolak akses ke section terlarang (dashboard/users/pengurus)
  const allowedView = $derived(isAdmin || !['dashboard', 'users', 'pengurus'].includes(view));

  const totalPages = $derived(Math.max(1, Math.ceil(list.total / PER_PAGE)));

  $effect(() => {
    if (!allowedView) view = 'atlit';
  });

  // periode dropdown khusus medali (opsi tetap dari konstanta PERIODE)
  const periodeOptions = $derived(active?.id === 'medali' ? PERIODE : []);

  // ===== statistik dashboard — angka dari /api/stats (agregasi SQL di server) =====
  const maxA = $derived(Math.max(1, ...stats.atlitPerCabor.map((x) => x.count)));
  const maxP = $derived(Math.max(1, ...stats.pelatihPerCabor.map((x) => x.count)));
  const maxK = $derived(Math.max(1, ...stats.klubPerCabang.map((x) => x.count)));
  const maxProj = $derived(Math.max(1, ...stats.atlitProyeksi.map((x) => x.count)));
  const totalProyeksi = $derived(stats.atlitProyeksi.reduce((s, x) => s + x.count, 0));

  const tingkatIcon: Record<string, string> = { Internasional: '🌍', Nasional: '🇮🇩', Provinsi: '🏙️' };

  function animateContent() {
    gsap.fromTo(
      '.content-card',
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: 0.06 }
    );
  }

  function setView(v: string) {
    view = v;
  }

  // buka view: daftar data di-fetch per halaman dari server; dashboard tarik agregasi stats
  function openView(v: string) {
    setView(v);
    if (!auth.user) return;
    if (v === 'dashboard') fetchStats();
    else fetchList(v);
  }

  function navigate(v: string) {
    form = null; // pindah menu selalu menutup form tambah/edit
    sidebarOpen = false;
    openView(v);
    // simpan ke URL agar refresh/back kembali ke page yang sama
    if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
  }

  // terapkan view dari URL hash (refresh / tombol back / hash manual)
  function applyHash() {
    const hash = location.hash.slice(1);
    if (!hash) return;
    if (hash === 'dashboard') {
      if (isAdmin) openView('dashboard');
      return;
    }
    if (menuSections.some((s) => s.id === hash)) openView(hash);
  }

  // pencarian server-side dengan debounce agar tidak nembak request per ketikan
  function applyFilter() {
    if (active) fetchList(active.id, { page: 1, q: list.q, periode: list.periode });
  }
  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilter, 300);
  }
  function gotoPage(p: number) {
    if (active) fetchList(active.id, { page: p, q: list.q, periode: list.periode });
  }

  function goToEdit(i: number) {
    if (!active) return;
    const row = list.rows[i];
    form = { section: active.id, id: row?.id ?? null };
  }

  async function remove(i: number) {
    if (!active || busy || !confirm('Hapus data ini?')) return;
    busy = true;
    try {
      const row = list.rows[i];
      if (row?.id) await deleteRow(active.id, row.id);
    } finally {
      busy = false;
    }
  }

  // modal detail: atlit butuh daftar prestasi → ambil baris penuh by id
  async function openDetail(row: Row) {
    detail = row;
    if (active?.id === 'atlit' && row.id != null) {
      const fresh = await fetchRow('atlit', row.id);
      if (fresh) detail = fresh;
    }
  }

  // ==== detail row ====
  let detail = $state<Row | null>(null);

  const DETAIL_LABELS: Record<string, string> = {
    nama: 'Nama', tempatLahir: 'Tempat Lahir', tanggalLahir: 'Tanggal Lahir',
    jenisKelamin: 'Jenis Kelamin', alamat: 'Alamat', kk: 'Kartu Keluarga (KK)',
    akte: 'Akte Lahir', ktp: 'KTP', piagam: 'Piagam', tahun: 'Tahun',
    tingkat: 'Tingkat Prestasi', lisensi: 'Lisensi Pelatih', fileLisensi: 'File Lisensi',
    tempat: 'Tempat Latihan', hari: 'Hari Latihan', jam: 'Jam Latihan',
    cabang: 'Cabang Olahraga', username: 'Username', cabor: 'Cabang Olahraga',
    proyeksiPorprov: 'Atlit Proyeksi Porprov X',
    periode: 'Periode',
    targetEmas: 'Target Emas', targetPerak: 'Target Perak', targetPerunggu: 'Target Perunggu',
    hasilEmas: 'Perolehan Emas', hasilPerak: 'Perolehan Perak', hasilPerunggu: 'Perolehan Perunggu',
    createdAt: 'Dibuat', createdBy: 'Dibuat Oleh',
    role: 'Role', jabatan: 'Jabatan', bio: 'Biodata', foto: 'Foto',
  };
  const DETAIL_SKIP = new Set(['id', 'atlitId', 'passwordHash', 'prestasi']);
  const FILE_KEYS = new Set(['kk', 'akte', 'ktp', 'piagam', 'fileLisensi']);

  // URL eksternal atau berkas hasil upload (/uploads/...) → dirender sebagai link/gambar
  const isUrl = (s: string) => /^https?:\/\//i.test(s) || s.startsWith('/uploads/');
  // potong bagian YYYY-MM-DD langsung dari string (tanpa Date) supaya tidak bergeser oleh timezone
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function prettyDate(s: string): string {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${+m[3]} ${BULAN[+m[2] - 1]} ${m[1]}` : s;
  }
  // timestamp unix (ms) → "31 Agustus 2026"
  function prettyTimestamp(v: unknown): string {
    const d = new Date(Number(v));
    return Number.isNaN(d.getTime()) ? String(v ?? '') : `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  }

  onMount(() => {
    hydrated = true;
    applyHash();
    // pesan sukses dari halaman tambah/edit (handoff antar dokumen)
    const t = sessionStorage.getItem('binpres-toast');
    if (t) {
      sessionStorage.removeItem('binpres-toast');
      notify(t);
    }
    window.addEventListener('hashchange', applyHash);
  });

  // animasi entrance harus jalan SETELAH DOM branch hydrated/auth terpasang
  // ($effect re-run saat auth.user berubah → animasi ulang untuk branch yang baru)
  $effect(() => {
    if (!hydrated) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (!auth.user) {
        gsap.from('.login-left > .relative', { x: -40, autoAlpha: 0, duration: 0.7, ease: 'power3.out' });
        gsap.from('.form-card', { y: 30, autoAlpha: 0, duration: 0.6, ease: 'power3.out', delay: 0.15 });
        gsap.from('.deco', { scale: 0, duration: 0.8, ease: 'back.out(1.4)', stagger: 0.12 });
        gsap.from('.login-chip', { y: 14, autoAlpha: 0, duration: 0.4, ease: 'power2.out', stagger: 0.07, delay: 0.4 });
        gsap.fromTo('.logo-badge', { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.7)' });
        return;
      }
      gsap.from('.sidebar-item', { x: -30, autoAlpha: 0, duration: 0.4, ease: 'power3.out', stagger: 0.05 });
      animateContent();
      gsap.from('.logo-badge', { scale: 0, rotation: -180, duration: 0.7, ease: 'back.out(1.7)' });
    });
    return () => mm.revert();
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (detail = null)} />

{#if !hydrated}
  <div class="min-h-screen"></div>
{:else if !auth.user}
  <div class="login-view grid min-h-screen lg:grid-cols-2">
    <!-- Panel kiri: branding -->
    <div class="login-left relative hidden overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-blue-900 lg:flex lg:flex-col lg:justify-center lg:p-14">
      <div class="deco absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10"></div>
      <div class="deco absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-blue-400/20"></div>
      <div class="deco absolute right-12 top-16 h-20 w-20 rounded-3xl bg-white/10 rotate-12"></div>
      <div class="relative z-10 text-white">
        <div class="logo-badge mb-6 h-16 w-16"><img src="/logo.png" alt="Logo BINPRES KONI" class="h-full w-full object-contain" /></div>
        <h1 class="text-4xl font-extrabold leading-tight">BINPRES KONI<br />Kota Probolinggo</h1>
        <p class="mt-4 max-w-sm text-sm leading-relaxed text-blue-100">Panel admin Bina Prestasi — kelola data atlit, pelatih, jadwal latihan, dan klub/dojo dari satu tempat.</p>
        <div class="mt-8 flex gap-3">
          {#each ['🏃 Atlit', '🎯 Pelatih', '📅 Jadwal', '🏟️ Klub'] as tag (tag)}
            <span class="login-chip rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">{tag}</span>
          {/each}
        </div>
        <p class="mt-10 text-[11px] text-blue-200/80">© 2026 KONI Kota Probolinggo</p>
      </div>
    </div>
    <!-- Panel kanan: form -->
    <div class="grid place-items-center bg-white p-6">
      <form onsubmit={doLogin} class="form-card w-full max-w-sm">
        <div class="logo-badge mb-4 h-14 w-14 lg:hidden"><img src="/logo.png" alt="Logo BINPRES KONI" class="h-full w-full object-contain" /></div>
        <h1 class="mb-1 text-2xl font-bold">Selamat Datang 👋</h1>
        <p class="mb-8 text-sm text-gray-400">Masuk untuk mengelola data BINPRES</p>
        <label class="form-field mb-4 block text-sm"><span class="mb-1 block font-medium text-gray-600">Username</span>
          <input bind:value={username} required placeholder="cth: adminkoni" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
        <label class="form-field mb-4 block text-sm"><span class="mb-1 block font-medium text-gray-600">Password</span>
          <input type="password" bind:value={password} required placeholder="••••••••" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
        {#if loginError}<p class="login-error mb-4 rounded-lg bg-blue-50 px-3 py-2 text-center text-xs font-semibold text-blue-600">{loginError}</p>{/if}
        <button type="submit" disabled={busy} class="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {#if busy}<span class="spinner"></span> Memproses...{:else}Masuk{/if}
        </button>
      </form>
    </div>
  </div>
{:else}
<div class="flex min-h-screen bg-gray-50 font-poppins text-gray-800">
  <!-- overlay drawer mobile -->
  {#if sidebarOpen}
    <button
      type="button"
      aria-label="Tutup menu"
      class="fixed inset-0 z-30 cursor-default bg-blue-950/50 backdrop-blur-sm lg:hidden"
      onclick={() => (sidebarOpen = false)}></button>
  {/if}

  <!-- Sidebar -->
  <aside
    class="sidebar fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col bg-linear-to-b from-blue-700 via-blue-600 to-blue-800 text-white shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:translate-x-0 {sidebarOpen
      ? 'translate-x-0'
      : '-translate-x-full'}">
    <div class="flex items-center gap-3 px-5 py-6">
      <div class="logo-badge h-11 w-11 shrink-0"><img src="/logo.png" alt="Logo BINPRES KONI" class="h-full w-full object-contain" /></div>
      <div>
        <p class="text-sm font-semibold leading-tight">BINPRES KONI</p>
        <p class="text-[11px] text-blue-100">Kota Probolinggo</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 pb-4 text-sm">
      {#if isAdmin}
        <button
          class="sidebar-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {view === 'dashboard' ? 'bg-white font-semibold text-blue-600 shadow-md' : 'hover:bg-blue-500/40'}"
          onclick={() => navigate('dashboard')}>
          <span>📊</span> Dashboard
        </button>
      {/if}

      <button
        class="sidebar-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {openCabang ? 'bg-blue-500/30' : 'hover:bg-blue-500/40'}"
        onclick={() => (openCabang = !openCabang)}>
        <span>🥋</span> Cabang Olahraga
        <span class="ml-auto text-xs transition-transform duration-200 {openCabang ? 'rotate-90' : ''}">▶</span>
      </button>

      {#if openCabang}
        <div class="ml-4 flex flex-col gap-1 border-l border-blue-400/50 pl-3">
          {#each menuSections.filter((s) => !['users', 'pengurus'].includes(s.id)) as s (s.id)}
            <button
              class="sidebar-item flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors {view === s.id ? 'bg-white font-semibold text-blue-600 shadow' : 'text-blue-100 hover:bg-blue-500/40'}"
              onclick={() => navigate(s.id)}>
              <span>{s.icon}</span> {s.label}
            </button>
          {/each}
        </div>
      {/if}

      {#if isAdmin}
        <p class="sidebar-item mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-blue-200">Sistem</p>
        {#each sections.filter((s) => ['users', 'pengurus'].includes(s.id)) as s (s.id)}
          <button
            class="sidebar-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {view === s.id ? 'bg-white font-semibold text-blue-600 shadow-md' : 'hover:bg-blue-500/40'}"
            onclick={() => navigate(s.id)}>
            <span>{s.icon}</span> {s.label}
          </button>
        {/each}
      {/if}
    </nav>

    <div class="mx-4 mb-3 rounded-xl bg-blue-900/40 p-3 text-[11px] text-blue-100">
      <p>{auth.user.nama} <span class="text-blue-200">({auth.user.cabor})</span></p>
      <button class="mt-2 w-full rounded-lg bg-white/10 py-1.5 font-semibold text-white transition hover:bg-white/20" onclick={() => logout()}>Logout</button>
    </div>
  </aside>

  <!-- Main -->
  <main class="min-w-0 flex-1 p-4 lg:p-8">
    <!-- topbar mobile -->
    <div class="sticky top-0 z-20 mb-4 flex items-center gap-3 rounded-xl bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-gray-100 backdrop-blur lg:hidden">
      <button
        class="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-lg text-white transition active:scale-95"
        aria-label="Buka menu"
        onclick={() => (sidebarOpen = !sidebarOpen)}>☰</button>
      <img src="/logo.png" alt="Logo BINPRES KONI" class="h-7 w-7 object-contain" />
      <p class="text-sm font-bold">BINPRES KONI</p>
    </div>

    {#if form}
      {#key form.section + (form.id ?? '')}
        <TambahForm section={form.section} editId={form.id} onDone={() => (form = null)} />
      {/key}
    {:else if view === 'dashboard' && isAdmin}
      <div class="content-card mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-blue-600 to-blue-500 p-6 text-white shadow-xl">
        <p class="text-xl font-bold">Selamat Datang, Admin BINPRES 👋</p>
        <p class="mt-1 text-sm text-blue-100">Panel Admin Bidang Pembinaan Prestasi KONI Kota Kota Probolinggo — kelola data atlit, pelatih, jadwal latihan, dan klub.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {#each sections as s (s.id)}
          {#if !stats.loaded}
            <div class="content-card animate-pulse rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
              <div class="h-8 w-8 rounded-lg bg-gray-200"></div>
              <div class="mt-4 h-8 w-14 rounded-lg bg-gray-200"></div>
              <div class="mt-2 h-3.5 w-24 rounded bg-gray-100"></div>
            </div>
          {:else}
          <button
            class="content-card group relative overflow-hidden rounded-2xl bg-white p-5 text-left shadow-lg ring-1 ring-gray-100 transition-transform duration-200 hover:-translate-y-1"
            onclick={() => navigate(s.id)}>
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50 transition-transform duration-300 group-hover:scale-125"></div>
            <span class="relative text-3xl">{s.icon}</span>
            <p class="relative mt-3 text-3xl font-bold text-blue-600">{stats.totals[s.id] ?? 0}</p>
            <p class="relative text-sm text-gray-500">Total {s.label}</p>
            <span class="relative mt-2 inline-block text-xs font-semibold text-blue-500 opacity-0 transition-opacity group-hover:opacity-100">Kelola →</span>
          </button>
          {/if}
        {/each}
      </div>

      <!-- Statistik per cabor & tingkat prestasi -->
      {#snippet bars(rows: { name: string; count: number }[], max: number)}
        {#each rows as x (x.name)}
          <div class="flex items-center gap-3 py-1.5">
            <span class="w-24 shrink-0 truncate text-xs font-medium text-gray-600" title={x.name}>{x.name}</span>
            <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full bg-linear-to-r from-blue-500 to-blue-600 transition-all duration-700" style={`width:${(x.count / max) * 100}%`}></div>
            </div>
            <span class="w-8 shrink-0 text-right text-xs font-bold text-blue-600">{x.count}</span>
          </div>
        {/each}
      {/snippet}

      {#snippet caborPanel(icon: string, title: string, rows: { name: string; count: number }[], max: number, totalLabel: string)}
        <div class="content-card rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
          <div class="mb-3 flex items-center justify-between">
            <p class="flex items-center gap-2 font-bold">{icon} {title}</p>
            <span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">{stats.loaded ? totalLabel : '…'}</span>
          </div>
          {#if !stats.loaded}
            {#each Array(4) as _, i (i)}<div class="mb-3 h-2.5 w-full animate-pulse rounded-full bg-gray-100"></div>{/each}
          {:else}
            <div class="max-h-64 overflow-y-auto pr-1">{@render bars(rows, max)}</div>
          {/if}
        </div>
      {/snippet}

      <div class="mt-6 grid gap-4 xl:grid-cols-3">
        {@render caborPanel('🏃', 'Atlit / Cabor', stats.atlitPerCabor, maxA, `${stats.totals.atlit ?? 0} atlit`)}
        {@render caborPanel('🎯', 'Pelatih / Cabor', stats.pelatihPerCabor, maxP, `${stats.totals.pelatih ?? 0} pelatih`)}
        {@render caborPanel('🏟️', 'Klub/Dojang / Cabor', stats.klubPerCabang, maxK, `${stats.totals.klub ?? 0} klub/dojang`)}
      </div>

      <div class="content-card mt-4 rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
        <p class="mb-4 flex items-center gap-2 font-bold">🏅 Medali Porprov <span class="text-xs font-medium text-gray-400">(Perolehan / Target)</span></p>
        {#if !stats.loaded}
          <div class="grid gap-3 sm:grid-cols-3">
            {#each Array(3) as _, i (i)}<div class="h-20 animate-pulse rounded-xl bg-gray-100"></div>{/each}
          </div>
        {:else}
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-xl bg-linear-to-br from-blue-50 to-blue-100/50 p-4 ring-1 ring-blue-100">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">🥇 Emas</p>
              <p class="mt-1 text-2xl font-extrabold text-gray-800">{stats.medaliTotal.h.e}<span class="text-sm font-semibold text-gray-400"> / {stats.medaliTotal.t.e}</span></p>
            </div>
            <div class="rounded-xl bg-linear-to-br from-blue-50 to-blue-100/50 p-4 ring-1 ring-blue-100">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">🥈 Perak</p>
              <p class="mt-1 text-2xl font-extrabold text-gray-800">{stats.medaliTotal.h.p}<span class="text-sm font-semibold text-gray-400"> / {stats.medaliTotal.t.p}</span></p>
            </div>
            <div class="rounded-xl bg-linear-to-br from-blue-50 to-blue-100/50 p-4 ring-1 ring-blue-100">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">🥉 Perunggu</p>
              <p class="mt-1 text-2xl font-extrabold text-gray-800">{stats.medaliTotal.h.b}<span class="text-sm font-semibold text-gray-400"> / {stats.medaliTotal.t.b}</span></p>
            </div>
          </div>
          <p class="mt-3 text-right text-[11px] text-gray-400">Total target: {stats.medaliTotal.t.e + stats.medaliTotal.t.p + stats.medaliTotal.t.b} medali • Total perolehan: {stats.medaliTotal.h.e + stats.medaliTotal.h.p + stats.medaliTotal.h.b} medali</p>
        {/if}
      </div>

      <div class="mt-4 grid gap-4 xl:grid-cols-2">
        <div class="content-card rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
        <p class="mb-4 flex items-center gap-2 font-bold">🏅 Prestasi Berdasarkan Tingkat</p>
        {#if !stats.loaded}
          <div class="grid gap-3 sm:grid-cols-3">
            {#each Array(3) as _, i (i)}<div class="h-20 animate-pulse rounded-xl bg-gray-100"></div>{/each}
          </div>
        {:else}
          <div class="grid gap-3 sm:grid-cols-3">
            {#each stats.prestasiTingkat.rows as t (t.name)}
              <div class="rounded-xl bg-linear-to-br from-blue-50 to-blue-100/50 p-4 ring-1 ring-blue-100">
                <p class="text-xs font-semibold uppercase tracking-wide text-blue-600">{tingkatIcon[t.name] ?? '🏅'} {t.name}</p>
                <p class="mt-1 text-2xl font-extrabold text-gray-800">{t.count}</p>
              </div>
            {/each}
          </div>
          <p class="mt-3 text-right text-[11px] text-gray-400">Total prestasi tercatat: {stats.prestasiTingkat.total}</p>
        {/if}
        </div>

        {@render caborPanel('⭐', 'Atlit Proyeksi Porprov X', stats.atlitProyeksi, maxProj, `${totalProyeksi} atlit`)}
      </div>
    {:else if active}
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 class="flex items-center gap-2 text-2xl font-bold">
          <span>{active.icon}</span> {active.label}
        </h1>
        <button
          onclick={() => (form = { section: active.id, id: null })}
          class="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 active:scale-95">
          + Tambah {active.label}
        </button>
      </div>

      <div class="content-card rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="🔍 Cari {active.label.toLowerCase()}..."
            bind:value={list.q}
            oninput={onSearch}
            class="w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
          {#if active.id === 'medali' && periodeOptions.length}
            <select
              bind:value={list.periode}
              onchange={applyFilter}
              class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100">
              <option value="">Semua Periode</option>
              {#each periodeOptions as p (p)}<option value={p}>{p}</option>{/each}
            </select>
          {/if}
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b-2 border-blue-100 text-xs uppercase tracking-wide text-blue-600">
                <th class="px-3 py-3">No</th>
                {#each active.fields as f (f.key)}
                  <th class="px-3 py-3">{f.label}</th>
                {/each}
                <th class="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#if list.loading}
                {#each Array(PER_PAGE) as _, i (i)}
                  <tr class="border-b border-gray-100">
                    <td class="px-3 py-3" colspan={active.fields.length + 2}>
                      <div class="h-4 w-full animate-pulse rounded bg-gray-100"></div>
                    </td>
                  </tr>
                {/each}
              {:else}
              {#each list.rows as row, i (row.id ?? i)}
                <tr class="cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/50" onclick={() => openDetail(row)}>
                  <td class="px-3 py-3 text-gray-400">{(list.page - 1) * PER_PAGE + i + 1}</td>
                  {#each active.fields as f (f.key)}
                    <td class="px-3 py-3 font-medium">
                      {#if f.type === 'date'}{prettyDate(String(row[f.key] ?? ''))}{:else if f.key === 'nama' && (active.id === 'atlit' || active.id === 'pelatih')}<span class="flex items-center gap-2.5">{#if String(row.foto ?? '').trim()}<img src={String(row.foto)} alt="" class="h-9 w-9 shrink-0 rounded-full object-cover object-top ring-2 ring-blue-100" loading="lazy" />{:else}<span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm">{active.icon}</span>{/if}<span class="min-w-0">{row[f.key]}</span></span>{:else}{row[f.key]}{/if}
                    </td>
                  {/each}
                  <td class="whitespace-nowrap px-3 py-3 text-right">
                    <button disabled={busy} class="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-200 disabled:opacity-50" onclick={(e) => { e.stopPropagation(); openDetail(row); }}>👁️ Detail</button>
                    <button disabled={busy} class="ml-1 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50" onclick={(e) => { e.stopPropagation(); goToEdit(i); }}>✏️ Edit</button>
                    {#if active.id === 'medali'}<button disabled={busy} class="ml-1 rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-50" onclick={(e) => { e.stopPropagation(); goToEdit(i); }}>🏅 Perolehan</button>{/if}
                    <button disabled={busy} class="ml-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50" onclick={(e) => { e.stopPropagation(); remove(i); }}>{#if busy}⏳{:else}🗑️{/if} Hapus</button>
                  </td>
                </tr>
              {:else}
                <tr><td colspan={active.fields.length + 2} class="px-3 py-8 text-center text-gray-400">Tidak ada data ditemukan.</td></tr>
              {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span class="text-gray-500">Halaman {list.page} dari {totalPages} · {list.total} data</span>
          <div class="flex gap-1">
            <button class="rounded-lg border px-3 py-1.5 transition {list.page === 1 ? 'text-gray-300' : 'hover:bg-blue-50'}" disabled={list.page === 1} onclick={() => gotoPage(list.page - 1)}>‹ Prev</button>
            {#each Array(totalPages) as _, i (i)}
              <button class="rounded-lg border px-3 py-1.5 font-semibold transition {list.page === i + 1 ? 'border-blue-600 bg-blue-600 text-white' : 'hover:bg-blue-50'}" onclick={() => gotoPage(i + 1)}>{i + 1}</button>
            {/each}
            <button class="rounded-lg border px-3 py-1.5 transition {list.page === totalPages ? 'text-gray-300' : 'hover:bg-blue-50'}" disabled={list.page === totalPages} onclick={() => gotoPage(list.page + 1)}>Next ›</button>
          </div>
        </div>
      </div>
    {/if}
  </main>

  <!-- ==== MODAL DETAIL ==== -->
  {#if detail}
    <div class="fixed inset-0 z-50 p-4">
      <button
        type="button"
        aria-label="Tutup detail"
        class="absolute inset-0 h-full w-full cursor-default bg-blue-950/50 backdrop-blur-sm"
        in:fade={{ duration: 150 }}
        onclick={() => (detail = null)}></button>
      <div
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="relative mx-auto mt-[7vh] max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100 focus:outline-none"
        in:scale={{ start: 0.95, duration: 180 }}
        out:fade={{ duration: 150 }}>
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <p class="flex items-center gap-2 font-bold">
            <span>{active?.icon}</span> Detail {active?.label}
          </p>
          <button class="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-sm transition hover:bg-blue-100" onclick={() => (detail = null)} aria-label="Tutup detail">✕</button>
        </div>

        <div class="grid gap-x-6 gap-y-3 px-6 py-5 sm:grid-cols-[150px_1fr]">
          {#each Object.entries(detail) as [k, v] (k)}
            {#if !DETAIL_SKIP.has(k)}
              {@const s = String(v ?? '').trim()}
              <span class="pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{DETAIL_LABELS[k] ?? k}</span>
              <div class="text-sm">
                {#if !s}
                  <span class="text-gray-300">—</span>
                {:else if k === 'foto' || k === 'bio'}
                  {#if isUrl(s)}<a href={s} target="_blank" rel="noopener"><img src={s} alt={s} class="max-h-52 w-full rounded-xl object-cover ring-1 ring-gray-200 transition hover:ring-blue-300" /></a>{:else}{s}{/if}
                {:else if FILE_KEYS.has(k)}
                  {#if isUrl(s)}
                    <a href={s} target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 underline underline-offset-2 ring-1 ring-blue-100 hover:bg-blue-100">📎 Buka berkas</a>
                  {:else}
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 ring-1 ring-gray-200">📎 {s}</span>
                  {/if}
                {:else if k === 'tanggalLahir'}
                  {prettyDate(s)}
                {:else if k === 'createdAt'}
                  {prettyTimestamp(v)}
                {:else if isUrl(s)}
                  <a href={s} target="_blank" rel="noopener" class="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800">📎 Buka berkas</a>
                {:else}
                  {s}
                {/if}
              </div>
            {/if}
          {/each}
        </div>

        {#if Array.isArray(detail.prestasi) && detail.prestasi.length}
          <div class="border-t border-gray-100 px-6 py-5">
            <p class="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">🏅 Daftar Prestasi</p>
            <ul class="flex flex-col gap-2">
              {#each detail.prestasi as p, i (i)}
                <li class="rounded-xl bg-blue-50/70 p-3 ring-1 ring-blue-100/60">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{String(p.tingkat || '-')}</span>
                    <span class="text-xs font-medium text-gray-500">{String(p.tahun || '-')}</span>
                    <p class="text-sm font-semibold">{String(p.nama || 'Prestasi')}</p>
                  </div>
                  {#if String(p.piagam || '').trim()}
                    {@const pu = String(p.piagam).trim()}
                    {#if isUrl(pu)}
                      <a href={pu} target="_blank" rel="noopener" class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 underline underline-offset-2 ring-1 ring-blue-100 hover:bg-blue-50">📎 Piagam — buka berkas</a>
                    {:else}
                      <span class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-500 ring-1 ring-gray-200">📎 {pu}</span>
                    {/if}
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>

    {#if ui.toast}
      <div
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-blue-600/30"
        role="status"
        in:fly={{ y: 16, duration: 200 }}
        out:fade={{ duration: 150 }}>
        ✅ {ui.toast}
      </div>
    {/if}
  {/if}
</div>
{/if}
