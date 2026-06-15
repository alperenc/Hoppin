import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export const HOPPIN_MEDIA_BUCKET = 'hoppin-media';

type UploadMediaOptions = {
  ownerId: string;
  kind: 'avatars' | 'checkins';
  uri: string;
};

const isRemoteUrl = (uri: string) => /^https?:\/\//i.test(uri);

const extensionFor = (contentType: string, uri: string) => {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('heic') || contentType.includes('heif')) return 'heic';

  const match = uri.split('?')[0]?.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase() ?? 'jpg';
};

export async function uploadHoppinMediaUri({ ownerId, kind, uri }: UploadMediaOptions): Promise<string> {
  const trimmedUri = uri.trim();

  if (!trimmedUri || isRemoteUrl(trimmedUri) || !isSupabaseConfigured) {
    return trimmedUri;
  }

  const response = await fetch(trimmedUri);
  if (!response.ok) {
    throw new Error('Could not read selected image.');
  }

  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const extension = extensionFor(contentType, trimmedUri);
  const token = Math.random().toString(36).slice(2, 10);
  const path = `${ownerId}/${kind}/${Date.now()}-${token}.${extension}`;

  const { error } = await supabase.storage.from(HOPPIN_MEDIA_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(HOPPIN_MEDIA_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Could not resolve uploaded image URL.');
  }

  return data.publicUrl;
}
