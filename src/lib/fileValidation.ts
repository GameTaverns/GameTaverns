/**
 * Shared file validation utilities for upload security
 */

const DOCUMENT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// Magic byte signatures for file type verification
const MAGIC_BYTES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP container)
};

/** Read the first N bytes of a File as a Uint8Array */
async function readFileHead(file: File, bytes = 8): Promise<Uint8Array> {
  const slice = file.slice(0, bytes);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Check if head bytes match any of the signatures for a given type */
function matchesMagic(head: Uint8Array, type: string): boolean {
  const signatures = MAGIC_BYTES[type];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => head[i] === byte)
  );
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a document file (PDF or image) by both MIME type and magic bytes.
 * Max size default: 50MB for documents.
 */
export async function validateDocumentFile(
  file: File,
  maxSizeBytes = 50 * 1024 * 1024
): Promise<ValidationResult> {
  // Size check
  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size: ${maxMB} MB` };
  }

  // MIME type check
  if (!DOCUMENT_ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "Invalid file type. Only PDF, JPEG, PNG, and WebP files are allowed.",
    };
  }

  // Magic bytes verification
  const head = await readFileHead(file);
  if (!matchesMagic(head, file.type)) {
    return {
      valid: false,
      error:
        "File content doesn't match its type. The file may be corrupted or renamed.",
    };
  }

  return { valid: true };
}

/**
 * Validate an image file by both MIME type and magic bytes.
 * Max size default: 10MB for images.
 */
export async function validateImageFile(
  file: File,
  maxSizeBytes = 10 * 1024 * 1024
): Promise<ValidationResult> {
  // Size check
  if (file.size > maxSizeBytes) {
    const maxMB = Math.round(maxSizeBytes / 1024 / 1024);
    return { valid: false, error: `File too large. Maximum size: ${maxMB} MB` };
  }

  // MIME type check
  if (!IMAGE_ALLOWED_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
    };
  }

  // Magic bytes verification
  const head = await readFileHead(file);
  if (!matchesMagic(head, file.type)) {
    return {
      valid: false,
      error:
        "File content doesn't match its type. The file may be corrupted or renamed.",
    };
  }

  return { valid: true };
}
