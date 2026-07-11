"use client";

import { useState, type ChangeEvent } from "react";

interface DocumentUploadFieldProps {
  label: string;
}

interface DocumentUploadResponse {
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export function DocumentUploadField({ label }: DocumentUploadFieldProps) {
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploading(true);
    setStatus("Uploading document...");

    // Read the sibling `category` select's current value from the same form so the file
    // is stored under the folder matching the metadata the admin is about to submit.
    const categoryField = event.target.form?.elements.namedItem("category");
    const category = categoryField instanceof HTMLSelectElement ? categoryField.value : "other";

    const data = new FormData();
    data.set("file", file);
    data.set("category", category);

    try {
      const response = await fetch("/api/documents/upload", { method: "POST", body: data });
      const payload = (await response.json()) as DocumentUploadResponse;

      if (!response.ok || !payload.filePath) {
        setStatus(payload.error ?? "Document upload failed.");
        return;
      }

      setFilePath(payload.filePath);
      setFileName(payload.fileName ?? file.name);
      setFileSize(String(payload.fileSize ?? file.size));
      setStatus("Document uploaded.");
    } catch {
      setStatus("Document upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-3xl border border-slate-200 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-slate-800">{label}</p>
          <p className="text-xs font-semibold text-slate-500">PDF only. Maximum 10MB.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          {isUploading ? "Uploading..." : "Upload PDF"}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      </div>
      <input type="hidden" name="filePath" value={filePath} />
      <input type="hidden" name="fileName" value={fileName} />
      <input type="hidden" name="fileSize" value={fileSize} />
      {fileName ? <p className="text-xs font-bold text-slate-600">Selected: {fileName}</p> : null}
      {status ? <p className="text-xs font-bold text-slate-600">{status}</p> : null}
    </div>
  );
}
