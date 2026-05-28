import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif']);
const AVATAR_MAX_PX = 600;
const MOMENT_MAX_PX = 1600;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const compatibleImagePickerOptions = {
  // Expo SDK 54 defaults to "current" on iOS, which can return HEIC/HEIF files.
  // Django/Pillow rejects those in ImageField validation, so request a compatible representation.
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
} satisfies Pick<ImagePicker.ImagePickerOptions, 'preferredAssetRepresentationMode'>;

function extensionFromPath(path: string): string | null {
  const cleanPath = path.split(/[?#]/, 1)[0] ?? '';
  const match = cleanPath.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function mimeFromPath(path: string): string | null {
  const ext = extensionFromPath(path);
  return ext ? MIME_BY_EXTENSION[ext] ?? null : null;
}

function replaceExtension(fileName: string, extension: string): string {
  if (/\.[a-z0-9]+$/i.test(fileName)) {
    return fileName.replace(/\.[a-z0-9]+$/i, extension);
  }
  return `${fileName}${extension}`;
}

export function photoUploadFromAsset(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
): { uri: string; name: string; type: string } {
  const rawName = asset.fileName?.trim() || fallbackName;
  const rawMimeType = asset.mimeType?.toLowerCase();
  const inferredMimeType = mimeFromPath(rawName) ?? mimeFromPath(asset.uri);
  const heicLike =
    HEIC_MIME_TYPES.has(rawMimeType ?? '') ||
    inferredMimeType === 'image/heic' ||
    inferredMimeType === 'image/heif';

  const type = heicLike ? 'image/jpeg' : rawMimeType ?? inferredMimeType ?? 'image/jpeg';
  const expectedExtension = EXTENSION_BY_MIME[type] ?? '.jpg';
  const name = replaceExtension(rawName, expectedExtension);

  return {
    uri: asset.uri,
    name,
    type,
  };
}

export async function resizeForAvatar(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; name: string; type: string }> {
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (w > AVATAR_MAX_PX || h > AVATAR_MAX_PX) {
    if (w >= h) {
      ctx.resize({ width: AVATAR_MAX_PX });
    } else {
      ctx.resize({ height: AVATAR_MAX_PX });
    }
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });

  return { uri: result.uri, name: 'profile-photo.jpg', type: 'image/jpeg' };
}

export async function resizeForMomentPhoto(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string,
): Promise<{ uri: string; name: string; type: string }> {
  const w = asset.width ?? 0;
  const h = asset.height ?? 0;

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (w > MOMENT_MAX_PX || h > MOMENT_MAX_PX) {
    if (w >= h) {
      ctx.resize({ width: MOMENT_MAX_PX });
    } else {
      ctx.resize({ height: MOMENT_MAX_PX });
    }
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });

  const name = fallbackName.replace(/\.[a-z0-9]+$/i, '.jpg');
  return { uri: result.uri, name, type: 'image/jpeg' };
}
