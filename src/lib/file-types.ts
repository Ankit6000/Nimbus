const IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
  ".dng",
  ".cr2",
  ".cr3",
  ".nef",
  ".arw",
  ".rw2",
  ".orf",
  ".raf",
  ".srw",
  ".svg",
  ".livp",
] as const;

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
  ".3gp",
  ".3g2",
  ".mts",
  ".m2ts",
  ".ts",
  ".mpg",
  ".mpeg",
  ".wmv",
  ".mxf",
] as const;

const ARCHIVE_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".iso",
  ".dmg",
  ".pkg",
] as const;

const SHEET_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".xls",
  ".xlsx",
  ".ods",
  ".numbers",
] as const;

export const PHOTO_VIDEO_ACCEPT =
  "image/*,video/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.heic,.heif,.avif,.dng,.cr2,.cr3,.nef,.arw,.rw2,.orf,.raf,.srw,.livp,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.3g2,.mts,.m2ts,.ts,.mpg,.mpeg,.wmv,.mxf";

export const PHOTO_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.heic,.heif,.avif,.dng,.cr2,.cr3,.nef,.arw,.rw2,.orf,.raf,.srw,.svg,.livp";

export const VIDEO_ACCEPT =
  "video/*,.mp4,.mov,.m4v,.webm,.mkv,.avi,.3gp,.3g2,.mts,.m2ts,.ts,.mpg,.mpeg,.wmv,.mxf";

function normalizeName(fileName: string) {
  return fileName.trim().toLowerCase();
}

function hasExtension(fileName: string, extensions: readonly string[]) {
  const normalized = normalizeName(fileName);
  return extensions.some((extension) => normalized.endsWith(extension));
}

export function isImageLikeFile(mimeType: string, fileName: string) {
  const normalizedMime = mimeType.toLowerCase();
  return normalizedMime.startsWith("image/") || hasExtension(fileName, IMAGE_EXTENSIONS);
}

export function isVideoLikeFile(mimeType: string, fileName: string) {
  const normalizedMime = mimeType.toLowerCase();
  return normalizedMime.startsWith("video/") || hasExtension(fileName, VIDEO_EXTENSIONS);
}

export function isArchiveLikeFile(mimeType: string, fileName: string) {
  const normalizedMime = mimeType.toLowerCase();
  return (
    normalizedMime.includes("zip") ||
    normalizedMime.includes("rar") ||
    normalizedMime.includes("7z") ||
    normalizedMime.includes("tar") ||
    normalizedMime.includes("gzip") ||
    normalizedMime.includes("bzip") ||
    normalizedMime.includes("xz") ||
    normalizedMime.includes("x-iso9660") ||
    normalizedMime.includes("diskimage") ||
    hasExtension(fileName, ARCHIVE_EXTENSIONS)
  );
}

export function isSheetLikeFile(mimeType: string, fileName: string) {
  const normalizedMime = mimeType.toLowerCase();
  return (
    normalizedMime.includes("sheet") ||
    normalizedMime.includes("excel") ||
    normalizedMime.includes("spreadsheet") ||
    hasExtension(fileName, SHEET_EXTENSIONS)
  );
}
