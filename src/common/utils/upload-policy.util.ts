import path from "path";

export const MAX_PRESIGNED_UPLOAD_BATCH = 20;

const IMAGE_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const DOCUMENT_EXTENSIONS: Readonly<Record<string, string>> = {
  ...IMAGE_EXTENSIONS,
  "application/pdf": ".pdf",
};

export class UploadPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadPolicyError";
  }
}

const validateSize = (sizeBytes: number | undefined, maxFileSize: number): void => {
  if (!Number.isSafeInteger(sizeBytes) || (sizeBytes as number) <= 0) {
    throw new UploadPolicyError("A valid fileSize is required.");
  }
  if ((sizeBytes as number) > maxFileSize) {
    throw new UploadPolicyError("File exceeds the maximum upload size.");
  }
};

const validateFileName = (fileName: string): void => {
  const baseName = path.basename(fileName || "");
  if (!baseName || baseName === "." || baseName.length > 255) {
    throw new UploadPolicyError("A valid fileName is required.");
  }
};

const validateMimeType = (
  fileName: string,
  mimeType: string,
  allowed: Readonly<Record<string, string>>,
): { mimeType: string; extension: string } => {
  validateFileName(fileName);
  const normalizedMimeType = (mimeType || "").trim().toLowerCase();
  const extension = allowed[normalizedMimeType];
  if (!extension) {
    throw new UploadPolicyError("This file type is not allowed.");
  }
  return { mimeType: normalizedMimeType, extension };
};

export const validateImageUpload = (
  fileName: string,
  mimeType: string,
  sizeBytes: number | undefined,
  maxFileSize: number,
): { mimeType: string; extension: string } => {
  validateSize(sizeBytes, maxFileSize);
  return validateMimeType(fileName, mimeType, IMAGE_EXTENSIONS);
};

export const validateDocumentUpload = (
  fileName: string,
  mimeType: string,
  sizeBytes: number | undefined,
  maxFileSize: number,
): { mimeType: string; extension: string } => {
  validateSize(sizeBytes, maxFileSize);
  return validateMimeType(fileName, mimeType, DOCUMENT_EXTENSIONS);
};

export const sanitizeUploadFolder = (folder?: string): string => {
  const requested = (folder || "uploads").trim().replace(/\\/g, "/");
  if (!requested || requested.length > 240 || requested.startsWith("/")) {
    throw new UploadPolicyError("Invalid upload folder.");
  }

  const segments = requested.split("/");
  if (
    segments.some((segment) => (
      !segment ||
      segment === "." ||
      segment === ".." ||
      segment.length > 80 ||
      !/^[a-zA-Z0-9_-]+$/.test(segment)
    ))
  ) {
    throw new UploadPolicyError("Invalid upload folder.");
  }

  return segments.join("/");
};

export const buildUserUploadRoot = (
  userType: string | undefined,
  userId: string,
): string => {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new UploadPolicyError("Invalid authenticated user.");
  }
  const role = /^[a-zA-Z0-9_-]+$/.test(userType || "") ? userType : "user";
  return `user-uploads/${role}/${userId}`;
};

export const buildUserUploadFolder = (
  userType: string | undefined,
  userId: string,
  requestedFolder?: string,
): string => {
  return `${buildUserUploadRoot(userType, userId)}/${sanitizeUploadFolder(requestedFolder)}`;
};
