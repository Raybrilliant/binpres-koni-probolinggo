<script lang="ts">
	import { tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { CABOR } from '../lib/store.svelte';

	// combobox: dropdown dengan pencarian di dalam panel (sumber: daftar resmi CABOR)
	let {
		value = $bindable(''),
	}: {
		value?: string;
	} = $props();

	const PINNED = 'Semua';
	let open = $state(false);
	let query = $state('');
	let hi = $state(0);
	let root = $state<HTMLDivElement>();
	let searchEl = $state<HTMLInputElement>();
	const uid = `cb-${Math.random().toString(36).slice(2, 8)}`;

	const opts = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const base = [...CABOR];
		if (!q) {
			// pertahankan nilai lama yang mungkin tidak ada di daftar resmi (data legacy)
			return [PINNED, ...(value && value !== PINNED && !base.includes(value) ? [value] : []), ...base];
		}
		return [PINNED, ...base.filter((c) => c.toLowerCase().includes(q))];
	});

	const label = (c: string) => (c === PINNED ? 'Semua (khusus Admin)' : c);

	function pick(c: string) {
		value = c;
		open = false;
	}

	async function show() {
		query = '';
		hi = Math.max(0, opts.indexOf(value));
		open = true;
		await tick();
		searchEl?.focus();
	}

	function scrollToHi() {
		root?.querySelector('[data-hi="true"]')?.scrollIntoView({ block: 'nearest' });
	}

	function onKey(e: KeyboardEvent) {
		if (!open) {
			if (['Enter', ' ', 'ArrowDown'].includes(e.key)) {
				e.preventDefault();
				show();
			}
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			hi = Math.min(opts.length - 1, hi + 1);
			scrollToHi();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			hi = Math.max(0, hi - 1);
			scrollToHi();
		} else if (e.key === 'Enter') {
			e.preventDefault(); // jangan submit form
			const c = opts[hi];
			if (c) pick(c);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window
	onpointerdown={(e) => {
		const t = e.target as Node;
		if (open && root && !root.contains(t)) open = false;
	}}
/>

<div
	bind:this={root}
	class="relative"
	role="combobox"
	aria-expanded={open}
	aria-controls={uid}
	aria-label="Pilih cabang olahraga"
	tabindex="-1"
	onkeydown={onKey}>
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-left text-sm shadow-sm transition hover:border-blue-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 {open ? 'border-blue-400 ring-2 ring-blue-100' : ''}"
		onclick={() => (open ? (open = false) : show())}>
		<span class={value ? 'font-medium' : 'text-gray-400'}>{value ? label(value) : 'Pilih Cabang Olahraga...'}</span>
		<span class="shrink-0 text-xs text-gray-400 transition-transform duration-200 {open ? 'rotate-180' : ''}">▾</span>
	</button>

	{#if open}
		<div
			id={uid}
			class="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-200"
			in:slide={{ duration: 150 }}
			out:slide={{ duration: 120 }}>
			<div class="sticky top-0 z-10 border-b border-gray-100 bg-white p-2">
				<input
					bind:this={searchEl}
					bind:value={query}
					type="search"
					placeholder="🔍 Ketik untuk mencari..."
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
			</div>
			<ul class="max-h-56 overflow-y-auto p-1" role="listbox">
				{#each opts as c, i (c)}
					<li>
						<button
							type="button"
							data-hi={i === hi}
							role="option"
							aria-selected={c === value}
							class="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors {i === hi ? 'bg-blue-50 font-semibold text-blue-700' : 'hover:bg-blue-50/50'} {c === value ? 'text-blue-700' : ''}"
							onmouseenter={() => (hi = i)}
							onclick={() => pick(c)}>
							{label(c)}{#if c === value}&nbsp;✓{/if}
						</button>
					</li>
				{:else}
					<li class="px-3 py-2 text-sm text-gray-400">Tidak ada cabang yang cocok.</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
