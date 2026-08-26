// Foto diambil saat build time — API key tidak pernah sampai ke client
const KEY: string = (import.meta.env.PEXELS_API_KEY || import.meta.env.PEXELS_API || '') as string;

export type Photo = { src: string; alt: string; photographer: string };

export async function searchPhotos(query: string, perPage = 1, orientation = 'landscape'): Promise<Photo[]> {
  if (!KEY) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`;
    const res = await fetch(url, { headers: { Authorization: KEY } });
    const j: any = await res.json();
    return (j.photos ?? []).map((p: any) => ({
      src: (orientation === 'portrait' ? p.src?.portrait : p.src?.large) ?? p.src?.large,
      alt: p.alt || query,
      photographer: p.photographer ?? '',
    }));
  } catch {
    return [];
  }
}

// fallback kalau tanpa API key: placeholder netral
export function fallbackPhoto(seed: string, w = 600, h = 800): string {
  return `https://picsum.photos/seed/${seed}/${w}/${h}`;
}
