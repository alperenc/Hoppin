import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

export const HOPPIN_AVATARS_BUCKET = 'hoppin-avatars';
export const HOPPIN_CHECKIN_MEDIA_BUCKET = 'hoppin-checkins';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SIGNED_CHECKIN_MEDIA_TTL_SECONDS = 60 * 60 * 24;

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

  const contentType = response.headers.get('content-type') ?? 'image/jpeg';
  const body = await response.arrayBuffer();

  if (body.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Choose an image under 5 MB.');
  }

  const extension = extensionFor(contentType, trimmedUri);
  const token = Math.random().toString(36).slice(2, 10);
  const path = `${ownerId}/${kind}/${Date.now()}-${token}.${extension}`;
  const bucket = kind === 'avatars' ? HOPPIN_AVATARS_BUCKET : HOPPIN_CHECKIN_MEDIA_BUCKET;

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    cacheControl: '3600',
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (kind === 'checkins') {
    return path;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error('Could not resolve uploaded image URL.');
  }

  return data.publicUrl;
}

export async function resolveCheckinMediaUrls(media: string[] = []): Promise<string[]> {
  const refs = media.map((item) => item.trim()).filter(Boolean);

  if (!refs.length || !isSupabaseConfigured) {
    return refs;
  }

  const urlsByRef = await resolveCheckinMediaUrlMap([refs]);
  return mapResolvedCheckinMediaUrls(refs, urlsByRef);
}

export async function resolveCheckinMediaUrlMap(mediaGroups: string[][]): Promise<Map<string, string>> {
  const refs = Array.from(
    new Set(mediaGroups.flatMap((group) => group.map((item) => item.trim()).filter(Boolean))),
  );
  const urlsByRef = new Map<string, string>();

  for (const ref of refs) {
    if (isRemoteUrl(ref) || !isSupabaseConfigured) {
      urlsByRef.set(ref, ref);
    }
  }

  if (!isSupabaseConfigured) {
    return urlsByRef;
  }

  const privatePaths = refs.filter((ref) => !isRemoteUrl(ref));
  if (!privatePaths.length) {
    return urlsByRef;
  }

  const { data, error } = await supabase.storage
    .from(HOPPIN_CHECKIN_MEDIA_BUCKET)
    .createSignedUrls(privatePaths, SIGNED_CHECKIN_MEDIA_TTL_SECONDS);

  if (error) {
    throw new Error(error.message);
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      urlsByRef.set(item.path, item.signedUrl);
    }
  }

  return urlsByRef;
}

export function mapResolvedCheckinMediaUrls(media: string[] = [], urlsByRef: ReadonlyMap<string, string>): string[] {
  return media
    .map((item) => item.trim())
    .filter(Boolean)
    .map((ref) => urlsByRef.get(ref))
    .filter((ref): ref is string => Boolean(ref));
}
