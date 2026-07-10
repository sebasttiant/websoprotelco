import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ALLOWED_IMAGE_TYPES, type StorageAdapter, type StoredFile } from "./index";

const uploadDirectory = path.join(process.cwd(), "public", "uploads");

const EXTENSIONS_BY_TYPE: Readonly<Record<string, string>> = {
  [ALLOWED_IMAGE_TYPES.JPEG]: "jpg",
  [ALLOWED_IMAGE_TYPES.PNG]: "png",
  [ALLOWED_IMAGE_TYPES.WEBP]: "webp",
};

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async save(file: File): Promise<StoredFile> {
      const extension = EXTENSIONS_BY_TYPE[file.type] ?? "bin";
      const filename = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
      const pathname = path.join(uploadDirectory, filename);
      const bytes = Buffer.from(await file.arrayBuffer());

      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(pathname, bytes, { flag: "wx" });

      return {
        url: `/uploads/${filename}`,
        pathname,
      };
    },
  };
}
