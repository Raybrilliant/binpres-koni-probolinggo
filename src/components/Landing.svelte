<script lang="ts">
  import { onMount } from 'svelte';
  import { CABOR, db, ui, refresh } from '../lib/store.svelte';
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  gsap.registerPlugin(ScrollTrigger);

  let {
    heroImage,
    photos, // fallback foto untuk row tanpa URL foto
  }: {
    heroImage: string;
    photos: string[];
  } = $props();

  let expanded = $state<number | 'ketua'>(-1);

  // statistik live dari spreadsheet (via store)
  const countOf = (id: string) => db.sections.find((s) => s.id === id)?.rows.length ?? 0;
  const stats = $derived({ atlit: countOf('atlit'), pelatih: countOf('pelatih'), klub: countOf('klub') });

  // pengurus live dari database (dikelola lewat panel admin)
  const allCards = $derived(
    (db.sections.find((s) => s.id === 'pengurus')?.rows ?? []).map((p, i) => ({
      nama: String(p.nama ?? ''),
      jabatan: String(p.jabatan ?? ''),
      bio: String(p.bio ?? ''),
      foto: p.foto ? String(p.foto) : photos[i % photos.length],
    }))
  );
  // ketua KONI dipisah ke kartu atas — dideteksi dari jabatan mengandung "ketua koni"
  const ketuaCard = $derived(allCards.find((c) => c.jabatan.toLowerCase().includes('ketua koni')) ?? null);
  const cards = $derived(allCards.filter((c) => c !== ketuaCard));

  // narasi bidang pembinaan prestasi (4 fokus utama)
  const narasi = [
    { img: '/vector/1.webp', title: 'Penguatan Prestasi Atlit', desc: 'Membangun kebanggaan publik melalui pencapaian prestasi atlet di kancah provinsi, nasional, hingga internasional.' },
    { img: '/vector/2.webp', title: 'Pembinaan yang Terencana', desc: 'Menyusun program pelatihan jangka panjang, pemusatan latihan (Puslatcab/Puslatkot), serta evaluasi secara berkala.' },
    { img: '/vector/3.webp', title: 'Penerapan Sport Intelligence', desc: 'Menggunakan basis data atlet, peta potensi daerah, dan analisis kekuatan lawan untuk kebijakan yang presisi.' },
    { img: '/vector/4.webp', title: 'Sinergi Cabang Olahraga', desc: 'Menyatukan langkah antara KONI, Pemerintah Daerah, dan Induk Cabang Olahraga (Cabor) dalam pembinaan atlet.' },
  ];

  // angka naik dari nilai yang sedang tampil ke nilai baru (aman dipanggil berulang)
  const shown = new WeakMap<HTMLElement, number>();
  const tweens = new WeakMap<HTMLElement, any>();

  function countUp(el: HTMLElement, target: number) {
    const cur = shown.get(el) ?? 0;
    if (cur === target) return;
    tweens.get(el)?.kill();
    const obj = { v: cur };
    tweens.set(
      el,
      gsap.to(obj, {
        v: target,
        duration: 1.4,
        ease: 'power2.out',
        onUpdate: () => {
          const val = Math.round(obj.v);
          el.textContent = String(val);
          shown.set(el, val);
        },
      })
    );
  }

  let xTo = $state<any>({});
  let yTo = $state<any>({});

  function bindTilt(e: MouseEvent) {
    const card = (e.currentTarget as HTMLElement);
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const id = card.dataset.tilt!;
    xTo[id]?.(px * 18);
    yTo[id]?.(py * -14);
  }
  function unbindTilt(e: MouseEvent) {
    const id = (e.currentTarget as HTMLElement).dataset.tilt!;
    xTo[id]?.(0);
    yTo[id]?.(0);
  }

  onMount(() => {
    // polling ringan agar statistik ter-update jika data diubah dari tempat lain (refresh dedup)
    const poll = setInterval(() => refresh(), 60_000);
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // hero entrance
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-badge', { y: 20, autoAlpha: 0, duration: 0.5 })
        .from('.hero-title .word', { y: 40, autoAlpha: 0, duration: 0.6, stagger: 0.08 }, '-=0.2')
        .from('.hero-desc', { y: 20, autoAlpha: 0, duration: 0.5 }, '-=0.3')
        .from('.hero-img-wrap', { scale: 0.9, autoAlpha: 0, duration: 0.8, ease: 'power4.out' }, '-=0.5')
        .from('.stat-card', { y: 60, autoAlpha: 0, duration: 0.7, stagger: 0.15, ease: 'back.out(1.4)' }, '-=0.4');

      // floating stat cards: idle bob lambat dengan ritme berbeda tiap kartu
      const bob = [
        { y: 12, duration: 3.6, delay: 0 },
        { y: 16, duration: 4.4, delay: 1.0 },
        { y: 10, duration: 4.0, delay: 2.0 },
      ];
      document.querySelectorAll<HTMLElement>('.stat-card').forEach((card, i) => {
        const cfg = bob[i % bob.length];
        gsap.to(card, { y: cfg.y, duration: cfg.duration, delay: cfg.delay, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      });

      // vector olahraga: melayang naik-turun dengan ritme & arah bervariasi
      document.querySelectorAll<HTMLElement>('.hero-vector').forEach((v, i) => {
        gsap.to(v, {
          y: i % 2 ? 16 : -14,
          rotation: i % 2 ? 6 : -6,
          duration: 3.5 + i * 0.6,
          delay: i * 0.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      });

      // tilt setup (quickTo = smooth mengikuti mouse, terasa "ditekan")
      document.querySelectorAll<HTMLElement>('.stat-card').forEach((card) => {
        const id = card.dataset.tilt!;
        xTo[id] = gsap.quickTo(card, 'rotationY', { duration: 0.4, ease: 'power3.out' });
        yTo[id] = gsap.quickTo(card, 'rotationZ', { duration: 0.4, ease: 'power3.out' });
      });

      // kartu narasi: entrance power-up saat masuk viewport (tanpa delay, serentak)
      document.querySelectorAll<HTMLElement>('.narasi-card').forEach((card) => {
        gsap.from(card, {
          y: 90,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 95%', once: true },
        });
      });

      // pengurus cards stagger saat masuk viewport (power-up, tanpa delay)
      document.querySelectorAll<HTMLElement>('.pengurus-card').forEach((card) => {
        gsap.from(card, {
          y: 90,
          autoAlpha: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 95%', once: true },
        });
      });

      // ornamen background漂浮
      gsap.utils.toArray<HTMLElement>('.ornament').forEach((o, i) => {
        gsap.to(o, {
          y: i % 2 ? -30 : 30,
          x: i % 3 ? 15 : -15,
          rotation: i % 2 ? 20 : -20,
          duration: 4 + i,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      });

      return () => {
        xTo = {};
        yTo = {};
      };
    });
    return () => {
      clearInterval(poll);
      mm.revert();
    };
  });

  // realtime: efek reaktif terhadap perubahan nilai ATAU status data pertama dari server
  $effect(() => {
    void ui.loaded;
    const targets = [stats.atlit, stats.pelatih, stats.klub];
    document.querySelectorAll<HTMLElement>('.stat-num').forEach((el, i) => {
      countUp(el, targets[i] ?? 0);
    });
  });
</script>

<div class="min-h-screen overflow-x-clip bg-white font-poppins text-gray-800">
  <!-- ==== HERO ==== -->
  <section class="relative overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-blue-800 text-white">
    <div class="ornament absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10"></div>
    <div class="ornament absolute right-1/3 -top-32 h-96 w-96 rounded-full bg-blue-400/20"></div>
    <div class="ornament absolute -bottom-24 -right-10 h-80 w-80 rounded-3xl bg-white/5 rotate-12"></div>

    <!-- vector olahraga melayang (di belakang konten, tidak interaktif) -->
    <img src="/vector/1.webp" alt="" aria-hidden="true" loading="lazy" class="hero-vector pointer-events-none absolute left-[3%] top-[14%] z-0 hidden h-28 w-28 rounded-2xl bg-white/20 object-contain p-2 ring-1 ring-white/30 md:block" />
    <img src="/vector/2.webp" alt="" aria-hidden="true" loading="lazy" class="hero-vector pointer-events-none absolute right-[3%] top-[8%] z-0 hidden h-32 w-32 rounded-2xl bg-white/20 object-contain p-2 ring-1 ring-white/30 md:block" />
    <img src="/vector/3.webp" alt="" aria-hidden="true" loading="lazy" class="hero-vector pointer-events-none absolute bottom-[10%] left-[7%] z-0 hidden h-24 w-24 rounded-2xl bg-white/20 object-contain p-2 ring-1 ring-white/30 md:block" />
    <img src="/vector/4.webp" alt="" aria-hidden="true" loading="lazy" class="hero-vector pointer-events-none absolute bottom-[5%] right-[34%] z-0 hidden h-28 w-28 rounded-2xl bg-white/20 object-contain p-2 ring-1 ring-white/30 md:block" />

    <div class="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div style="perspective: 1000px">
        <span class="hero-badge inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur"><img src="/logo.png" alt="" class="h-5 w-5 object-contain" />KONI Kota Probolinggo</span>
        <h1 class="hero-title mt-5 text-4xl font-extrabold leading-tight lg:text-5xl">
          {#each ['Bina', 'Prestasi,', 'Wujudkan', 'Juara', 'Muda'] as w, i (i)}<span class="word inline-block">{w}&nbsp;</span>{/each}
        </h1>
        <p class="hero-desc mt-5 max-w-md text-sm leading-relaxed text-blue-100">
          BINPRES KONI Kota Probolinggo membina atlet muda berbakat lintas cabang olahraga — dari pembinaan prestasi, pembinaan pelatih profesional, hingga fasilitasi klub/dojo di Kota Probolinggo.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="#pengurus" class="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow-xl transition hover:scale-105 active:scale-95">Lihat Pengurus</a>
          <a href="/admin" class="rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold backdrop-blur transition hover:bg-white/10">Gabung Sekarang</a>
        </div>
      </div>

      <div class="hero-img-wrap relative mx-auto w-full max-w-md">
        <div class="overflow-hidden rounded-3xl shadow-2xl ring-4 ring-white/20">
          <img src={heroImage} alt="BINPRES KONI Probolinggo" class="aspect-4/3 w-full object-cover" loading="eager" />
        </div>

        <!-- 3 floating glass cards -->
        <div class="pointer-events-auto absolute -left-6 top-8 sm:-left-12">
          <div data-tilt="t1" role="figure" aria-label="Statistik atlitr terdaftar" class="stat-card flex h-28 w-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/30 p-4 shadow-2xl shadow-black/20 will-change-transform" onmousemove={bindTilt} onmouseleave={unbindTilt}>
            <div class="shine absolute inset-0 rounded-2xl bg-linear-to-tr from-transparent via-white/25 to-transparent"></div>
            <span class="text-xl leading-none">🏃</span>
            <div>
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={stats.atlit}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-white/90">Atlit Terdaftar</p>
            </div>
          </div>
        </div>
        <div class="absolute -right-4 top-1/2 sm:-right-10">
          <div data-tilt="t2" role="figure" aria-label="Statistik pelatih terdaftar" class="stat-card flex h-28 w-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/30 p-4 shadow-2xl shadow-black/20 will-change-transform" onmousemove={bindTilt} onmouseleave={unbindTilt}>
            <div class="shine absolute inset-0 rounded-2xl bg-linear-to-tr from-transparent via-white/25 to-transparent"></div>
            <span class="text-xl leading-none">🎯</span>
            <div>
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={stats.pelatih}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-white/90">Pelatih Terdaftar</p>
            </div>
          </div>
        </div>
        <div class="absolute -bottom-6 left-1/4">
          <div data-tilt="t3" role="figure" aria-label="Statistik perguruan terdaftar" class="stat-card flex h-28 w-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/30 p-4 shadow-2xl shadow-black/20 will-change-transform" onmousemove={bindTilt} onmouseleave={unbindTilt}>
            <div class="shine absolute inset-0 rounded-2xl bg-linear-to-tr from-transparent via-white/25 to-transparent"></div>
            <span class="text-xl leading-none">🏟️</span>
            <div>
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={stats.klub}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-white/90">Perguruan Terdaftar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ==== NARASI BINPRES ==== -->
  <section id="narasi" class="relative overflow-hidden bg-linear-to-b from-blue-50/60 to-white py-20">
    <!-- ornamen background -->
    <div class="ornament absolute -left-16 top-24 h-56 w-56 rounded-full bg-blue-100/70"></div>
    <div class="ornament absolute right-8 top-10 h-20 w-20 rotate-12 rounded-3xl bg-blue-100"></div>
    <div class="ornament absolute bottom-16 left-1/4 h-14 w-14 rounded-full border-2 border-dashed border-blue-200"></div>
    <div class="ornament absolute bottom-24 right-1/4 h-28 w-28 rounded-3xl bg-blue-50"></div>

    <div class="relative mx-auto max-w-6xl px-6">
      <div class="mb-12 text-center">
        <span class="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">Strategi</span>
        <h2 class="mt-2 text-3xl font-extrabold">Bidang Pembinaan Prestasi <span class="text-blue-600">(BINPRES)</span></h2>
        <p class="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-500">
          Kerangka komunikasi dan strategi pengelolaan yang fokus pada peningkatan kemampuan atlet secara terarah,
          berbasis data, dan berkesinambungan untuk Kota Probolinggo.
        </p>
      </div>

      <div class="grid gap-5 sm:grid-cols-2">
        {#each narasi as n, i (i)}
          <div class="narasi-card group flex gap-5 rounded-3xl bg-white p-5 shadow-lg shadow-blue-100/50 ring-1 ring-blue-100 transition-shadow hover:shadow-xl">
            <img
              src={n.img}
              alt={n.title}
              class="h-24 w-24 shrink-0 self-center rounded-2xl bg-blue-50 object-contain p-2 transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
            <div>
              <span class="text-[11px] font-extrabold uppercase tracking-widest text-blue-300">Fokus 0{i + 1}</span>
              <h3 class="text-base font-bold leading-snug">{n.title}</h3>
              <p class="mt-1.5 text-[13px] leading-relaxed text-gray-500">{n.desc}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ==== PENGURUS ==== -->
  <section id="pengurus" class="relative overflow-hidden py-20">
    <!-- ornamen background -->
    <div class="ornament absolute left-10 top-16 h-24 w-24 rounded-3xl bg-blue-100"></div>
    <div class="ornament absolute right-16 top-40 h-32 w-32 rounded-full bg-blue-50"></div>
    <div class="ornament absolute bottom-24 left-1/3 h-16 w-16 rotate-12 rounded-2xl bg-blue-100"></div>
    <div class="ornament absolute bottom-10 right-1/4 h-20 w-20 rounded-full bg-blue-50"></div>
    <div class="ornament absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 rounded-full border-2 border-dashed border-blue-100"></div>

    <div class="relative mx-auto max-w-6xl px-6">
      <div class="mb-10 text-center">
        <span class="text-xs font-bold uppercase tracking-[0.25em] text-white/800">Struktur Organisasi</span>
        <h2 class="mt-2 text-3xl font-extrabold">Pengurus BINPRES KONI</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-gray-400">Klik kartu untuk melihat biodata pengurus</p>
      </div>

      {#if !ui.loaded}
        <!-- skeleton saat menunggu data dari server -->
        <div class="flex flex-col gap-4 lg:flex-row">
          {#each Array(5) as _, i (i)}
            <div class="h-105 shrink-0 flex-1 animate-pulse rounded-3xl bg-blue-50"></div>
          {/each}
        </div>
      {:else}
        {#snippet pengurusCard(p: { nama: string; jabatan: string; bio: string; foto: string }, key: number | 'ketua', rowClass: string)}
          <button
            class="pengurus-card group relative h-105 shrink-0 overflow-hidden rounded-3xl {rowClass || 'bg-blue-600'} text-left text-white shadow-xl ring-1 ring-blue-200 transition-all duration-500 ease-out {expanded === key ? 'lg:grow-[3.5] lg:basis-0' : 'lg:grow lg:basis-0 hover:-translate-y-1'}"
            onclick={() => (expanded = expanded === key ? -1 : key)}>
            <img src={p.foto} alt={p.nama} class="absolute inset-x-0 top-0 h-72 w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="absolute inset-x-0 bottom-0 p-5">
              <p class="text-base font-bold">{p.nama}</p>
              <p class="mt-0.5 text-xs font-medium text-blue-100">{p.jabatan}</p>

              <!-- panel biodata: muncul saat expand (mobile: fade-in; desktop: muncul dari kanan) -->
              <div class="grid transition-all duration-500 {expanded === key && p.bio ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}">
                <div class="overflow-hidden">
                  <p class="max-w-md text-[12.5px] leading-relaxed text-white/80">{p.bio}</p>
                </div>
              </div>
            </div>
            <span class="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs backdrop-blur transition-transform duration-500 {expanded === key ? 'rotate-45' : ''}">✕</span>
          </button>
        {/snippet}

        {#if ketuaCard}
          <div class="mb-4 flex justify-center lg:mb-8">
            <div class="w-full max-w-sm">{@render pengurusCard(ketuaCard, 'ketua', 'bg-blue-700')}</div>
          </div>
        {/if}
        <div class="flex flex-col gap-4 lg:flex-row">
        {#each cards as p, i (i)}
          {@render pengurusCard(p, i, '')}
        {/each}
        </div>
        {#if allCards.length === 0}
          <p class="py-10 text-center text-sm text-gray-400">Data pengurus akan segera diperbarui.</p>
        {/if}
      {/if}
    </div>
  </section>

  <!-- ==== FOOTER ==== -->
  <footer class="relative overflow-hidden bg-linear-to-br from-blue-700 via-blue-600 to-blue-800 text-white">
    <div class="ornament absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10"></div>
    <div class="ornament absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-blue-400/20"></div>

    <div class="relative mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <div class="flex items-center gap-3">
          <div class="h-11 w-11 shrink-0"><img src="/logo.png" alt="Logo BINPRES KONI" class="h-full w-full object-contain" /></div>
          <div>
            <p class="text-sm font-bold leading-tight">BINPRES KONI</p>
            <p class="text-[11px] text-blue-100">Kota Probolinggo</p>
          </div>
        </div>
        <p class="mt-4 text-xs leading-relaxed text-blue-100/90">
          Komite Nasional Olahraga Indonesia — Pembinaan Prestasi Olahraga Kota Probolinggo. Membina atlet muda berbakat lintas cabang olahraga menuju prestasi nasional.
        </p>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-blue-200">Navigasi</p>
        <ul class="flex flex-col gap-2.5 text-xs text-blue-100">
          <li><a href="/" class="transition hover:text-white hover:underline">Beranda</a></li>
          <li><a href="#narasi" class="transition hover:text-white hover:underline">Narasi Binpres</a></li>
          <li><a href="#pengurus" class="transition hover:text-white hover:underline">Pengurus</a></li>
          <li><a href="/admin" class="transition hover:text-white hover:underline">Panel Admin</a></li>
        </ul>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-blue-200">Cabang Olahraga</p>
        <ul class="grid max-h-40 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto pr-1 text-[11px] text-blue-100">
          {#each CABOR as c (c)}
            <li class="truncate">{c}</li>
          {/each}
        </ul>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-blue-200">Kontak</p>
        <ul class="flex flex-col gap-2.5 text-xs text-blue-100">
          <li>📍 Jl. Slamet Riyadi No. 143, Kel. Kanigaran, Kec. Kanigaran, Kota Probolinggo</li>
          <li>📞<a href="https://wa.me/6285233062968" target="_blank" rel="noopener" class="transition hover:text-white hover:underline">0852-3306-2968 (WhatsApp)</a></li>
        </ul>
      </div>
    </div>

    <div class="relative border-t border-white/15 py-5 text-center text-[11px] text-blue-200">
      © 2026 BINPRES KONI Kota Probolinggo · made with <span class=" animate-pulse">❤️</span> by <a href="https://raybrilliant.my.id" class="italic text-amber-200">raybrilliant</a>
    </div>
  </footer>
</div>

<style>
  /* glass stat card: frosted blur asli, default smoky putih, hover lebih clear */
  .stat-card {
    position: relative;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    background: rgba(255, 255, 255, 0.16);
    transition: background 0.3s ease;
  }
  .stat-card:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .stat-card .shine {
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  .stat-card:hover .shine {
    opacity: 1;
  }

  /* fade foto menempel pada fotonya sendiri (mask), jadi tetap smooth saat hover scale */
  .pengurus-card img {
    -webkit-mask-image: linear-gradient(to bottom, #000 68%, transparent 98%);
    mask-image: linear-gradient(to bottom, #000 68%, transparent 98%);
  }
</style>
