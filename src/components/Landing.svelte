<script lang="ts">
  import { onMount } from 'svelte';
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';

  gsap.registerPlugin(ScrollTrigger);

  let {
    heroImage,
    pengurus,
  }: {
    heroImage: string;
    pengurus: { nama: string; jabatan: string; bio: string; foto: string }[];
  } = $props();

  let expanded = $state(-1);
  let counts = $state({ atlit: 0, pelatih: 0, klub: 0, loaded: false });

  const ENDPOINT: string = (import.meta.env.PUBLIC_GAS_ENDPOINT || '') as string;

  async function loadCounts() {
    if (!ENDPOINT) {
      counts = { atlit: 12, pelatih: 8, klub: 5, loaded: true }; // fallback demo
      return;
    }
    try {
      const j = await (await fetch(`${ENDPOINT}?sheet=all`)).json();
      counts = {
        atlit: j.data?.atlit?.length ?? 0,
        pelatih: j.data?.pelatih?.length ?? 0,
        klub: j.data?.['klub/dojang/perguruan']?.length ?? 0,
        loaded: true,
      };
    } catch {
      counts = { ...counts, loaded: true };
    }
  }

  // angka naik 0 → nilai
  function countUp(el: HTMLElement, target: number) {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.4,
      ease: 'power2.out',
      onUpdate: () => (el.textContent = String(Math.round(obj.v))),
    });
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
    loadCounts();
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

      // tilt setup (quickTo = smooth mengikuti mouse, terasa "ditekan")
      document.querySelectorAll<HTMLElement>('.stat-card').forEach((card) => {
        const id = card.dataset.tilt!;
        xTo[id] = gsap.quickTo(card, 'rotationY', { duration: 0.4, ease: 'power3.out' });
        yTo[id] = gsap.quickTo(card, 'rotationZ', { duration: 0.4, ease: 'power3.out' });
      });

      // pengurus cards stagger saat masuk viewport
      document.querySelectorAll<HTMLElement>('.pengurus-card').forEach((card, i) => {
        gsap.from(card, {
          y: 50,
          autoAlpha: 0,
          duration: 0.6,
          delay: (i % 4) * 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 90%', once: true },
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
    return () => mm.revert();
  });

  $effect(() => {
    if (counts.loaded) {
      document.querySelectorAll<HTMLElement>('.stat-num').forEach((el) => {
        countUp(el, Number(el.dataset.target ?? 0));
      });
    }
  });
</script>

<div class="min-h-screen overflow-x-clip bg-white font-poppins text-gray-800">
  <!-- ==== HERO ==== -->
  <section class="relative overflow-hidden bg-linear-to-br from-red-700 via-red-600 to-red-800 text-white">
    <div class="ornament absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10"></div>
    <div class="ornament absolute right-1/3 -top-32 h-96 w-96 rounded-full bg-red-400/20"></div>
    <div class="ornament absolute -bottom-24 -right-10 h-80 w-80 rounded-3xl bg-white/5 rotate-12"></div>

    <div class="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div style="perspective: 1000px">
        <span class="hero-badge inline-block rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold backdrop-blur">KONI Kota Probolinggo</span>
        <h1 class="hero-title mt-5 text-4xl font-extrabold leading-tight lg:text-5xl">
          {#each ['Bina', 'Prestasi,', 'Wujudkan', 'Juara', 'Muda'] as w, i (i)}<span class="word inline-block">{w}&nbsp;</span>{/each}
        </h1>
        <p class="hero-desc mt-5 max-w-md text-sm leading-relaxed text-red-100">
          BINPRES KONI Kota Probolinggo membina atlet muda berbakat lintas cabang olahraga — dari pembinaan prestasi, pembinaan pelatih profesional, hingga fasilitasi klub/dojo di Kota Probolinggo.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="#pengurus" class="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-red-600 shadow-xl transition hover:scale-105 active:scale-95">Lihat Pengurus</a>
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
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={counts.atlit}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-red-50/90">Atlit Terdaftar</p>
            </div>
          </div>
        </div>
        <div class="absolute -right-4 top-1/2 sm:-right-10">
          <div data-tilt="t2" role="figure" aria-label="Statistik pelatih terdaftar" class="stat-card flex h-28 w-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/30 p-4 shadow-2xl shadow-black/20 will-change-transform" onmousemove={bindTilt} onmouseleave={unbindTilt}>
            <div class="shine absolute inset-0 rounded-2xl bg-linear-to-tr from-transparent via-white/25 to-transparent"></div>
            <span class="text-xl leading-none">🎯</span>
            <div>
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={counts.pelatih}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-red-50/90">Pelatih Terdaftar</p>
            </div>
          </div>
        </div>
        <div class="absolute -bottom-6 left-1/4">
          <div data-tilt="t3" role="figure" aria-label="Statistik perguruan terdaftar" class="stat-card flex h-28 w-36 cursor-pointer flex-col justify-between rounded-2xl border border-white/30 p-4 shadow-2xl shadow-black/20 will-change-transform" onmousemove={bindTilt} onmouseleave={unbindTilt}>
            <div class="shine absolute inset-0 rounded-2xl bg-linear-to-tr from-transparent via-white/25 to-transparent"></div>
            <span class="text-xl leading-none">🏟️</span>
            <div>
              <p class="stat-num text-2xl font-extrabold leading-none" data-target={counts.klub}>0</p>
              <p class="mt-1 text-[11px] font-medium leading-tight text-red-50/90">Perguruan Terdaftar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ==== PENGURUS ==== -->
  <section id="pengurus" class="relative overflow-hidden py-20">
    <!-- ornamen background -->
    <div class="ornament absolute left-10 top-16 h-24 w-24 rounded-3xl bg-red-100"></div>
    <div class="ornament absolute right-16 top-40 h-32 w-32 rounded-full bg-red-50"></div>
    <div class="ornament absolute bottom-24 left-1/3 h-16 w-16 rotate-12 rounded-2xl bg-red-100"></div>
    <div class="ornament absolute bottom-10 right-1/4 h-20 w-20 rounded-full bg-red-50"></div>
    <div class="ornament absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 rounded-full border-2 border-dashed border-red-100"></div>

    <div class="relative mx-auto max-w-6xl px-6">
      <div class="mb-10 text-center">
        <span class="text-xs font-bold uppercase tracking-[0.25em] text-red-500">Struktur Organisasi</span>
        <h2 class="mt-2 text-3xl font-extrabold">Pengurus BINPRES KONI</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-gray-400">Klik kartu untuk melihat biodata pengurus</p>
      </div>

      <div class="flex flex-col gap-4 lg:flex-row">
        {#each pengurus as p, i (i)}
          <button
            class="pengurus-card group relative h-105 shrink-0 overflow-hidden rounded-3xl bg-red-600 text-left text-white shadow-xl ring-1 ring-red-200 transition-all duration-500 ease-out {expanded === i ? 'lg:grow-[3.5] lg:basis-0' : 'lg:grow lg:basis-0 hover:-translate-y-1'}"
            onclick={() => (expanded = expanded === i ? -1 : i)}>
            <img src={p.foto} alt={p.nama} class="absolute inset-x-0 top-0 h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              <div class="absolute inset-x-0 bottom-0 p-5">
              <p class="text-base font-bold">{p.nama}</p>
              <p class="mt-0.5 text-xs font-medium text-red-100">{p.jabatan}</p>

              <!-- panel biodata: muncul saat expand (mobile: fade-in; desktop: muncul dari kanan) -->
              <div class="grid transition-all duration-500 {expanded === i ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}">
                <div class="overflow-hidden">
                  <p class="max-w-md text-[12.5px] leading-relaxed text-red-50">{p.bio}</p>
                </div>
              </div>
            </div>
            <span class="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs backdrop-blur transition-transform duration-500 {expanded === i ? 'rotate-45' : ''}">✕</span>
          </button>
        {/each}
      </div>
    </div>
  </section>

  <!-- ==== FOOTER ==== -->
  <footer class="relative overflow-hidden bg-linear-to-br from-red-700 via-red-600 to-red-800 text-white">
    <div class="ornament absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10"></div>
    <div class="ornament absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-red-400/20"></div>

    <div class="relative mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-xl bg-white text-lg font-bold text-red-600 shadow-lg">BK</div>
          <div>
            <p class="text-sm font-bold leading-tight">BINPRES KONI</p>
            <p class="text-[11px] text-red-100">Kota Probolinggo</p>
          </div>
        </div>
        <p class="mt-4 text-xs leading-relaxed text-red-100/90">
          Komite Nasional Olahraga Indonesia — Pembinaan Prestasi Olahraga Kota Probolinggo. Membina atlet muda berbakat lintas cabang olahraga menuju prestasi nasional.
        </p>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-red-200">Navigasi</p>
        <ul class="flex flex-col gap-2.5 text-xs text-red-100">
          <li><a href="#" class="transition hover:text-white hover:underline">Beranda</a></li>
          <li><a href="#pengurus" class="transition hover:text-white hover:underline">Pengurus</a></li>
          <li><a href="/admin" class="transition hover:text-white hover:underline">Panel Admin</a></li>
        </ul>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-red-200">Cabang Olahraga</p>
        <ul class="flex flex-col gap-2.5 text-xs text-red-100">
          {#each ['Taekwondo', 'Karate', 'Pencak Silat', 'Sepak Bola', 'Bola Voli'] as c (c)}
            <li>{c}</li>
          {/each}
        </ul>
      </div>

      <div>
        <p class="mb-4 text-xs font-bold uppercase tracking-widest text-red-200">Kontak</p>
        <ul class="flex flex-col gap-2.5 text-xs text-red-100">
          <li>📍 Jl. Mayangan, Kota Probolinggo, Jawa Timur</li>
          <li>📞 (0335) 000000</li>
          <li>✉️ info@koniprobolinggo.go.id</li>
        </ul>
      </div>
    </div>

    <div class="relative border-t border-white/15 py-5 text-center text-[11px] text-red-200">
      © 2026 BINPRES KONI Kota Probolinggo · made with <span class=" animate-pulse">💙</span> by <a href="https://raybrilliant.my.id" class="italic text-amber-200">raybrilliant</a>
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
