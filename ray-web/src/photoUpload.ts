import { fitImageDimensions, PHOTO_JPEG_QUALITY } from '../../ray-shared/photoRules';

/** Browser adapter for the same JPEG quality and size limits as mobile. */
export async function preparePhoto(file: File, maxDimension: number): Promise<File> {
  const uri = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not read ' + file.name + '. Try a JPEG or PNG photo.'));
      image.src = uri;
    });
    const size = fitImageDimensions(image.naturalWidth, image.naturalHeight, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo processing is unavailable in this browser.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result
        ? resolve(result)
        : reject(new Error('Could not prepare ' + file.name + ' for upload.')), 'image/jpeg', PHOTO_JPEG_QUALITY);
    });
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    URL.revokeObjectURL(uri);
  }
}
