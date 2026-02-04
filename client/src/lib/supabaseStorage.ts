import { supabase } from "./supabaseClient";

const UPLOADS_BUCKET = "uploads";

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
}

/**
 * Upload a file to Supabase Storage. Path must start with {userId}/...
 * Returns the public URL for the uploaded file (bucket must be public).
 */
export async function uploadFile(
  path: string,
  file: File,
  options?: UploadOptions
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(path, file, {
      contentType: options?.contentType ?? file.type,
      upsert: options?.upsert ?? true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(UPLOADS_BUCKET)
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

/**
 * Get the public URL for a file in the uploads bucket.
 * Use this when storing only the path in DB; if you store the full URL from uploadFile, no need to call this for display.
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage
    .from(UPLOADS_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Remove a file from Storage. Path is the storage path (e.g. userId/chantierId/file.jpg), not the full URL.
 */
export async function removeFile(path: string): Promise<void> {
  const pathOnly = path.startsWith("http")
    ? path.replace(/^.*\/storage\/v1\/object\/public\/uploads\//, "")
    : path;
  const { error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .remove([pathOnly]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Extract storage path from a public URL saved in DB (for delete).
 * If the value is already a path (no http), returns as-is.
 */
export function publicUrlToPath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) return urlOrPath;
  const match = urlOrPath.match(/\/storage\/v1\/object\/public\/uploads\/(.+)$/);
  return match ? match[1] : urlOrPath;
}
