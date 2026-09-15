/**
 * Client-side Image Compression Utility
 * Resizes large smartphone camera photos (5MB - 12MB) to crisp, lightweight files (~200KB - 400KB)
 * prior to uploading to Supabase Storage.
 * Zero-dependency, pure HTML5 Canvas implementation.
 */

export type CompressionOptions = {
  maxDimension?: number;
  quality?: number;
  minSizeToCompress?: number;
};

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxDimension: 1600,       // 1600px is optimal for document / receipt legibility
  quality: 0.8,            // 80% JPEG quality retains razor-sharp text
  minSizeToCompress: 300 * 1024 // Only compress files larger than 300KB
};

export async function compressImage(
  file: File,
  optionsOrMaxDim?: number | CompressionOptions,
  qualityArg?: number
): Promise<File> {
  // 1. Guard against SSR or non-image files (e.g. PDFs)
  if (typeof window === "undefined" || !file || !file.type.startsWith("image/")) {
    return file;
  }

  // 2. Skip GIFs or SVGs which shouldn't be compressed via Canvas
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  const options: Required<CompressionOptions> = typeof optionsOrMaxDim === "number"
    ? {
        maxDimension: optionsOrMaxDim,
        quality: qualityArg ?? DEFAULT_OPTIONS.quality,
        minSizeToCompress: DEFAULT_OPTIONS.minSizeToCompress
      }
    : {
        ...DEFAULT_OPTIONS,
        ...(optionsOrMaxDim || {})
      };

  const { maxDimension, quality, minSizeToCompress } = options;

  // 3. Skip already small files to save client CPU
  if (file.size <= minSizeToCompress) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Calculate aspect-ratio preserved dimensions
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve(file);
          }

          // Use smooth rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                // If compressed is somehow larger than original, keep original
                return resolve(file);
              }

              // Create a new File instance keeping the original name (or normalizing to jpg)
              const newFileName = file.name.replace(/\.[^.]+$/, ".jpg");
              const compressedFile = new File([blob], newFileName, {
                type: "image/jpeg",
                lastModified: Date.now()
              });

              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        } catch (err) {
          console.warn("Image compression error, falling back to original file:", err);
          resolve(file);
        }
      };

      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };

    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function compressFiles(
  files: File[],
  optionsOrMaxDim?: number | CompressionOptions,
  qualityArg?: number
): Promise<File[]> {
  if (!files || files.length === 0) return [];
  return Promise.all(files.map(file => compressImage(file, optionsOrMaxDim, qualityArg)));
}

// Named aliases for full backward compatibility
export const compressImageFiles = compressFiles;
export const compressImageFile = compressImage;

