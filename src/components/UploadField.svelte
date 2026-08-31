<script lang="ts">
	import { slide } from 'svelte/transition';
	import { API, deleteUpload, uploadFile } from '../lib/store.svelte';

	// value = URL berkas hasil upload (/uploads/xxx) — atau link lama dari data lama
	let {
		value = $bindable(''),
		required = false,
		accept = 'image/jpeg,image/png,image/webp,application/pdf',
		placeholder = 'Pilih berkas (gambar/PDF, maks 3MB)',
	}: {
		value?: string;
		required?: boolean;
		accept?: string;
		placeholder?: string;
	} = $props();

	let busy = $state(false);
	let err = $state('');
	let fileName = $state('');
	let inputEl = $state<HTMLInputElement>();
	// URL file yang baru diunggah di sesi form ini — boleh dihapus dari server saat tombol Hapus
	let freshUrl = $state('');

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		err = '';
		const file = input.files?.[0];
		if (!file) return;
		if (file.size > 3 * 1024 * 1024) {
			err = 'Ukuran berkas maksimal 3MB';
			input.value = '';
			return;
		}
		busy = true;
		const r = await uploadFile(file);
		busy = false;
		if (r.ok && r.url) {
			freshUrl = r.url;
			value = `${API}${r.url}`;
			fileName = file.name;
		} else {
			err = r.error ?? 'Gagal mengunggah berkas';
		}
		input.value = '';
	}

	function clear() {
		// file sesi ini dihapus dari server; file lama milik baris dibiakan —
		// cascade PATCH/DELETE di backend yang mengurusnya (aman kalau batal edit)
		if (freshUrl && value === `${API}${freshUrl}`) deleteUpload(freshUrl);
		value = '';
		freshUrl = '';
		fileName = '';
		if (inputEl) inputEl.value = '';
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<input
		bind:this={inputEl}
		type="file"
		{accept}
		{required}
		disabled={busy}
		title={placeholder}
		class="w-full cursor-pointer rounded-xl border border-gray-200 bg-white text-xs text-gray-500 outline-none transition file:mr-3 file:cursor-pointer file:rounded-l-xl file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-blue-600 hover:border-blue-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
		onchange={pick}
	/>
	{#if busy}
		<span class="inline-flex items-center gap-2 text-xs font-medium text-blue-600">
			<span class="spinner"></span> Mengunggah...
		</span>
	{/if}
</div>
{#if err}
	<p class="mt-1 text-xs font-semibold text-red-600" transition:slide={{ duration: 120 }}>{err}</p>
{/if}
{#if value}
	<p class="mt-1 flex items-center gap-2 text-xs" transition:slide={{ duration: 120 }}>
		<a href={value} target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800">
			📎 Lihat berkas terunggah
		</a>
		<button type="button" class="rounded-lg bg-red-50 px-2 py-0.5 font-semibold text-red-600 transition hover:bg-red-100" onclick={clear}>Hapus</button>
	</p>
{/if}
