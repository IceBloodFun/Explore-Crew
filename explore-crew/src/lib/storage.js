import { supabase } from "@/lib/supabaseClient";

// http(s) ?
export function isHttpUrl(v) {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

// si on a une ancienne public URL supabase, on récupère le path après `/object/public/event-photos/`
export function pathFromPublicUrl(url) {
  if (!isHttpUrl(url)) return null;
  const m = url.match(/\/object\/public\/event-photos\/(.+)$/i);
  return m ? m[1] : null;
}

// Signe un tableau de rows { file_path?, photo_url? } et renvoie un tableau cloné avec photo_url "utilisable"
export async function signEventPhotoRows(rows, expiresIn = 3600) {
  const uniquePaths = new Set();

  for (const r of rows || []) {
    if (r?.file_path) {
      uniquePaths.add(r.file_path);
    } else if (r?.photo_url) {
      const p = pathFromPublicUrl(r.photo_url);
      if (p) uniquePaths.add(p);
    }
  }

  const paths = Array.from(uniquePaths);
  let map = {};
  if (paths.length) {
    const { data, error } = await supabase
      .storage
      .from("event-photos")
      .createSignedUrls(paths, expiresIn);
    if (!error && Array.isArray(data)) {
      // data[] garde l'ordre des "paths"
      data.forEach((row, idx) => {
        map[paths[idx]] = row.signedUrl || null;
      });
    }
  }

  // retourne des rows clonés avec une photo_url utilisable
  return (rows || []).map((r) => {
    // priorité: file_path
    if (r?.file_path && map[r.file_path]) {
      return { ...r, photo_url: map[r.file_path] };
    }
    // vieille public URL ? (convertible)
    if (r?.photo_url) {
      const p = pathFromPublicUrl(r.photo_url);
      if (p && map[p]) {
        return { ...r, photo_url: map[p] };
      }
      // URL externe (non supabase) => garder telle quelle
      if (isHttpUrl(r.photo_url)) return r;
    }
    return r;
  });
}
