<script lang="ts">
  import { onMount } from 'svelte';
  import gsap from 'gsap';
  import { db, save, auth, login, logout, deleteRow, ui } from '../lib/store.svelte';

  const sections = db.sections;

  let view = $state('dashboard');
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
      view = 'dashboard';
      gsap.from('.sidebar', { x: -60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      gsap.fromTo('.login-error', { x: -10 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    }
  }
  $effect(() => {
    const hash = location.hash.slice(1);
    if (hash && sections.some((s) => s.id === hash)) view = hash;
  });
  let openCabang = $state(true);
  let search = $state('');
  let page = $state(1);
  const perPage = 5;

  const active = $derived(sections.find((s) => s.id === view));

  const filtered = $derived(
    active
      ? active.rows.filter((r) =>
          Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase())
        )
      : []
  );
  const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / perPage)));
  const paged = $derived(filtered.slice((page - 1) * perPage, page * perPage));

  function animateContent() {
    gsap.fromTo(
      '.content-card',
      { y: 24, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', stagger: 0.06 }
    );
  }

  function navigate(v: string) {
    view = v;
    search = '';
    page = 1;
    animateContent();
  }

  function goToEdit(i: number) {
    if (!active) return;
    const row = filtered[(page - 1) * perPage + i];
    location.href = row.id
      ? `/admin/${active.id}/tambah?id=${row.id}`
      : `/admin/${active.id}/tambah?index=${(page - 1) * perPage + i}`;
  }

  async function remove(i: number) {
    if (!active || busy || !confirm('Hapus data ini?')) return;
    busy = true;
    try {
      const row = filtered[(page - 1) * perPage + i];
      if (row.id) await deleteRow(active.id, row.id);
      else {
        active.rows.splice((page - 1) * perPage + i, 1);
        save();
        if (page > totalPages) page = totalPages;
      }
    } finally {
      busy = false;
    }
  }

  onMount(() => {
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

{#if !auth.user}
  <div class="grid min-h-screen lg:grid-cols-2">
    <!-- Panel kiri: branding -->
    <div class="login-left relative hidden overflow-hidden bg-linear-to-br from-red-700 via-red-600 to-red-900 lg:flex lg:flex-col lg:justify-center lg:p-14">
      <div class="deco absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10"></div>
      <div class="deco absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-red-400/20"></div>
      <div class="deco absolute right-12 top-16 h-20 w-20 rounded-3xl bg-white/10 rotate-12"></div>
      <div class="relative z-10 text-white">
        <div class="logo-badge mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl font-bold text-red-600 shadow-xl">BK</div>
        <h1 class="text-4xl font-extrabold leading-tight">BINPRES KONI<br />Kota Probolinggo</h1>
        <p class="mt-4 max-w-sm text-sm leading-relaxed text-red-100">Panel admin Bina Prestasi — kelola data atlit, pelatih, jadwal latihan, dan klub/dojo dari satu tempat.</p>
        <div class="mt-8 flex gap-3">
          {#each ['🏃 Atlit', '🎯 Pelatih', '📅 Jadwal', '🏟️ Klub'] as tag (tag)}
            <span class="login-chip rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">{tag}</span>
          {/each}
        </div>
        <p class="mt-10 text-[11px] text-red-200/80">© 2026 KONI Kota Probolinggo</p>
      </div>
    </div>
    <!-- Panel kanan: form -->
    <div class="grid place-items-center bg-white p-6">
      <form onsubmit={doLogin} class="form-card w-full max-w-sm">
        <div class="logo-badge mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-600 text-xl font-bold text-white shadow-lg lg:hidden">BK</div>
        <h1 class="mb-1 text-2xl font-bold">Selamat Datang 👋</h1>
        <p class="mb-8 text-sm text-gray-400">Masuk untuk mengelola data BINPRES</p>
        <label class="form-field mb-4 block text-sm"><span class="mb-1 block font-medium text-gray-600">Username</span>
          <input bind:value={username} required placeholder="cth: adminkoni" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100" /></label>
        <label class="form-field mb-4 block text-sm"><span class="mb-1 block font-medium text-gray-600">Password</span>
          <input type="password" bind:value={password} required placeholder="••••••••" class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100" /></label>
        {#if loginError}<p class="login-error mb-4 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600">{loginError}</p>{/if}
        <button type="submit" disabled={busy} class="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60">
          {#if busy}<span class="spinner"></span> Memproses...{:else}Masuk{/if}
        </button>
      </form>
    </div>
  </div>
{:else}
<div class="flex min-h-screen bg-gray-50 font-poppins text-gray-800">
  <!-- Sidebar -->
  <aside class="sidebar sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-linear-to-b from-red-700 via-red-600 to-red-800 text-white shadow-2xl">
    <div class="flex items-center gap-3 px-5 py-6">
      <div class="logo-badge grid h-11 w-11 place-items-center rounded-xl bg-white text-lg font-bold text-red-600 shadow-lg">BK</div>
      <div>
        <p class="text-sm font-semibold leading-tight">BINPRES KONI</p>
        <p class="text-[11px] text-red-100">Kota Probolinggo</p>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 pb-4 text-sm">
      <button
        class="sidebar-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {view === 'dashboard' ? 'bg-white font-semibold text-red-600 shadow-md' : 'hover:bg-red-500/40'}"
        onclick={() => navigate('dashboard')}>
        <span>📊</span> Dashboard
      </button>

      <button
        class="sidebar-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {openCabang ? 'bg-red-500/30' : 'hover:bg-red-500/40'}"
        onclick={() => (openCabang = !openCabang)}>
        <span>🥋</span> Cabang Olahraga
        <span class="ml-auto text-xs transition-transform duration-200 {openCabang ? 'rotate-90' : ''}">▶</span>
      </button>

      {#if openCabang}
        <div class="ml-4 flex flex-col gap-1 border-l border-red-400/50 pl-3">
          {#each sections.filter((s) => s.id !== 'users') as s (s.id)}
            <button
              class="sidebar-item flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors {view === s.id ? 'bg-white font-semibold text-red-600 shadow' : 'text-red-100 hover:bg-red-500/40'}"
              onclick={() => navigate(s.id)}>
              <span>{s.icon}</span> {s.label}
            </button>
          {/each}
        </div>
      {/if}

      <p class="sidebar-item mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-red-200">Sistem</p>
      {#each sections.filter((s) => s.id === 'users') as s (s.id)}
        <button
          class="sidebar-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors {view === s.id ? 'bg-white font-semibold text-red-600 shadow-md' : 'hover:bg-red-500/40'}"
          onclick={() => navigate(s.id)}>
          <span>{s.icon}</span> {s.label}
        </button>
      {/each}
    </nav>

    <div class="mx-4 mb-5 rounded-xl bg-red-900/40 p-3 text-[11px] text-red-100">
      <p>{auth.user.nama} <span class="text-red-200">({auth.user.cabor})</span></p>
      <button class="mt-2 w-full rounded-lg bg-white/10 py-1.5 font-semibold text-white transition hover:bg-white/20" onclick={() => logout()}>Logout</button>
    </div>
  </aside>

  <!-- Main -->
  <main class="flex-1 p-6 lg:p-8">
    {#if view === 'dashboard'}
      <div class="content-card mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-red-600 to-red-500 p-6 text-white shadow-xl">
        <p class="text-xl font-bold">Selamat Datang, Admin BINPRES 👋</p>
        <p class="mt-1 text-sm text-red-100">Panel admin Bina Prestasi KONI Kota Probolinggo — kelola data atlit, pelatih, jadwal latihan, dan klub.</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {#each sections as s (s.id)}
          {#if !ui.loaded}
            <div class="content-card animate-pulse rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
              <div class="h-8 w-8 rounded-lg bg-gray-200"></div>
              <div class="mt-4 h-8 w-14 rounded-lg bg-gray-200"></div>
              <div class="mt-2 h-3.5 w-24 rounded bg-gray-100"></div>
            </div>
          {:else}
          <button
            class="content-card group relative overflow-hidden rounded-2xl bg-white p-5 text-left shadow-lg ring-1 ring-gray-100 transition-transform duration-200 hover:-translate-y-1"
            onclick={() => navigate(s.id)}>
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-50 transition-transform duration-300 group-hover:scale-125"></div>
            <span class="relative text-3xl">{s.icon}</span>
            <p class="relative mt-3 text-3xl font-bold text-red-600">{s.rows.length}</p>
            <p class="relative text-sm text-gray-500">Total {s.label}</p>
            <span class="relative mt-2 inline-block text-xs font-semibold text-red-500 opacity-0 transition-opacity group-hover:opacity-100">Kelola →</span>
          </button>
          {/if}
        {/each}
      </div>
    {:else if active}
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 class="flex items-center gap-2 text-2xl font-bold">
          <span>{active.icon}</span> {active.label}
        </h1>
        <a
          href="/admin/{active.id}/tambah"
          class="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-700 active:scale-95">
          + Tambah {active.label}
        </a>
      </div>

      <div class="content-card rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
        <input
          type="search"
          placeholder="🔍 Cari {active.label.toLowerCase()}..."
          bind:value={search}
          oninput={() => (page = 1)}
          class="mb-4 w-full max-w-sm rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100" />

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead>
              <tr class="border-b-2 border-red-100 text-xs uppercase tracking-wide text-red-600">
                <th class="px-3 py-3">No</th>
                {#each active.fields as f (f.key)}
                  <th class="px-3 py-3">{f.label}</th>
                {/each}
                <th class="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#if !ui.loaded}
                {#each Array(5) as _, i (i)}
                  <tr class="border-b border-gray-100">
                    <td class="px-3 py-3" colspan={active.fields.length + 2}>
                      <div class="h-4 w-full animate-pulse rounded bg-gray-100"></div>
                    </td>
                  </tr>
                {/each}
              {:else}
              {#each paged as row, i (page + '-' + ((page - 1) * perPage + i))}
                <tr class="border-b border-gray-100 transition-colors hover:bg-red-50/50">
                  <td class="px-3 py-3 text-gray-400">{(page - 1) * perPage + i + 1}</td>
                  {#each active.fields as f (f.key)}
                    <td class="px-3 py-3 font-medium">{row[f.key]}</td>
                  {/each}
                  <td class="whitespace-nowrap px-3 py-3 text-right">
                    <button disabled={busy} class="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 disabled:opacity-50" onclick={() => goToEdit(i)}>✏️ Edit</button>
                    <button disabled={busy} class="ml-1 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-50" onclick={() => remove(i)}>{#if busy}⏳{:else}🗑️{/if} Hapus</button>
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
          <span class="text-gray-500">Halaman {page} dari {totalPages} · {filtered.length} data</span>
          <div class="flex gap-1">
            <button class="rounded-lg border px-3 py-1.5 transition {page === 1 ? 'text-gray-300' : 'hover:bg-red-50'}" disabled={page === 1} onclick={() => page--}>‹ Prev</button>
            {#each Array(totalPages) as _, i (i)}
              <button class="rounded-lg border px-3 py-1.5 font-semibold transition {page === i + 1 ? 'border-red-600 bg-red-600 text-white' : 'hover:bg-red-50'}" onclick={() => (page = i + 1)}>{i + 1}</button>
            {/each}
            <button class="rounded-lg border px-3 py-1.5 transition {page === totalPages ? 'text-gray-300' : 'hover:bg-red-50'}" disabled={page === totalPages} onclick={() => page++}>Next ›</button>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
{/if}
