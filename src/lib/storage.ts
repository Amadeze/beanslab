import crypto from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const SAFE_OBJECT_SEGMENT = /[^a-z0-9._-]/gi;

function e2eLocalStorageRoot() {
  const configured = process.env.ROASTD_E2E_LOCAL_STORAGE_ROOT?.trim();
  return configured ? resolve(configured) : null;
}

function assertLocalStorageAllowed(message: string) {
  if (process.env.NODE_ENV === "production" && !e2eLocalStorageRoot()) {
    throw new Error(message);
  }
}

function safeObjectSegment(value: string) {
  const safe = value.replace(SAFE_OBJECT_SEGMENT, "-").replace(/-+/g, "-");
  if (!safe || safe === "." || safe === "..") {
    throw new Error("Invalid object storage path segment.");
  }
  return safe;
}

function safeObjectNamespace(value: string) {
  return value
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(safeObjectSegment)
    .join("/");
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

export function hasValidImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }
  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

export async function uploadImage(input: {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!extension || !hasValidImageSignature(input.buffer, input.mimeType)) {
    throw new Error("File content does not match the selected image type.");
  }

  const objectPath = `${input.tenantId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "ros-assets";

  if (!e2eLocalStorageRoot() && supabaseUrl && serviceRoleKey) {
    const body = input.buffer.buffer.slice(
      input.buffer.byteOffset,
      input.buffer.byteOffset + input.buffer.byteLength,
    ) as ArrayBuffer;
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": input.mimeType,
          "x-upsert": "false",
        },
        body,
      },
    );
    if (!response.ok) {
      throw new Error(`Object storage upload failed with status ${response.status}.`);
    }
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
  }

  assertLocalStorageAllowed("Object storage is not configured.");

  const uploadDir = e2eLocalStorageRoot()
    ? join(e2eLocalStorageRoot()!, "public-uploads", input.tenantId)
    : join(process.cwd(), "public", "uploads", input.tenantId);
  await mkdir(uploadDir, { recursive: true });
  const filename = objectPath.split("/").at(-1)!;
  await writeFile(join(uploadDir, filename), input.buffer);
  return `/uploads/${input.tenantId}/${filename}`;
}

export type PrivateImageObject = {
  buffer: Buffer;
  mimeType: string;
};

/**
 * Stores a tenant-owned binary object in the private bucket.
 * This is intentionally generic so operational artifacts such as Artisan
 * `.alog` files never pass through the public image-only upload path.
 */
export async function uploadPrivateObject(input: {
  tenantId: string;
  namespace: string;
  buffer: Buffer;
  mimeType: string;
  extension: string;
}) {
  const extension = input.extension.toLowerCase().replace(/^\./, "");
  if (!/^[a-z0-9]{1,10}$/.test(extension)) {
    throw new Error("Invalid private object extension.");
  }

  const tenantSegment = safeObjectSegment(input.tenantId);
  const namespace = safeObjectNamespace(input.namespace);
  if (!namespace) throw new Error("Private object namespace is required.");

  const objectPath = `${tenantSegment}/${namespace}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || "ros-private";

  if (!e2eLocalStorageRoot() && supabaseUrl && serviceRoleKey) {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": input.mimeType,
          "x-upsert": "false",
        },
        body: toArrayBuffer(input.buffer),
      },
    );
    if (!response.ok) {
      throw new Error(`Private object storage upload failed with status ${response.status}.`);
    }
    return objectPath;
  }

  assertLocalStorageAllowed("Private object storage is not configured.");

  const privateRoot = join(e2eLocalStorageRoot() ?? resolve(process.cwd(), ".data"), "private-uploads");
  const filePath = join(privateRoot, ...objectPath.split("/"));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, input.buffer);
  return objectPath;
}

export async function uploadPrivateImage(input: {
  tenantId: string;
  namespace: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const extension = MIME_EXTENSIONS[input.mimeType];
  if (!extension || !hasValidImageSignature(input.buffer, input.mimeType)) {
    throw new Error("File content does not match the selected image type.");
  }
  return uploadPrivateObject({ ...input, extension });
}

export async function readPrivateImage(
  objectPath: string,
  mimeType: string,
): Promise<PrivateImageObject> {
  if (!Object.hasOwn(MIME_EXTENSIONS, mimeType)) {
    throw new Error("Unsupported private image type.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PRIVATE_STORAGE_BUCKET || "ros-private";
  if (!e2eLocalStorageRoot() && supabaseUrl && serviceRoleKey) {
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error(`Private object storage read failed with status ${response.status}.`);
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
  }

  assertLocalStorageAllowed("Private object storage is not configured.");
  const privateRoot = join(e2eLocalStorageRoot() ?? resolve(process.cwd(), ".data"), "private-uploads");
  const resolvedPath = resolve(privateRoot, ...objectPath.split("/"));
  if (!resolvedPath.startsWith(`${privateRoot}\\`) && resolvedPath !== privateRoot) {
    throw new Error("Invalid private object path.");
  }
  return { buffer: await readFile(resolvedPath), mimeType };
}
