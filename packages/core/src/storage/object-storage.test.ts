import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createObjectStorageFromEnv,
  createS3ObjectStorage,
  getObjectStorageConfigFromEnv,
  type ObjectStorageFetch
} from "./object-storage";

describe("getObjectStorageConfigFromEnv", () => {
  it("builds a Cloudflare R2 compatible S3 config from env", () => {
    expect(
      getObjectStorageConfigFromEnv({
        STORAGE_PROVIDER: "s3",
        S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
        S3_BUCKET: "ai-crm-documents",
        S3_REGION: "auto",
        S3_ACCESS_KEY_ID: "access",
        S3_SECRET_ACCESS_KEY: "secret"
      })
    ).toEqual({
      provider: "s3",
      endpoint: "https://account.r2.cloudflarestorage.com",
      bucket: "ai-crm-documents",
      region: "auto",
      accessKeyId: "access",
      secretAccessKey: "secret"
    });
  });

  it("uses local storage when no object bucket is configured", () => {
    expect(getObjectStorageConfigFromEnv({})).toEqual({
      provider: "local",
      localDir: "./.local-storage"
    });
  });
});

describe("local object storage", () => {
  it("writes and reads bytes under the configured storage directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-crm-storage-"));

    try {
      const storage = createObjectStorageFromEnv({
        STORAGE_PROVIDER: "local",
        LOCAL_STORAGE_DIR: directory
      });

      await storage.putObject({
        key: "workspaces/workspace-1/templates/kp/template.docx",
        body: new Uint8Array([1, 2, 3]),
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      await expect(readFile(join(directory, "workspaces", "workspace-1", "templates", "kp", "template.docx"))).resolves.toEqual(
        Buffer.from([1, 2, 3])
      );
      await expect(storage.getObject("workspaces/workspace-1/templates/kp/template.docx")).resolves.toEqual(new Uint8Array([1, 2, 3]));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("createS3ObjectStorage", () => {
  it("uploads to an S3-compatible endpoint with signed headers", async () => {
    const fetchMock = vi.fn<ObjectStorageFetch>().mockResolvedValue(new Response(null, { status: 200 }));
    const storage = createS3ObjectStorage(
      {
        provider: "s3",
        endpoint: "https://account.r2.cloudflarestorage.com",
        bucket: "ai-crm-documents",
        region: "auto",
        accessKeyId: "access",
        secretAccessKey: "secret"
      },
      { fetch: fetchMock, now: () => new Date("2026-05-21T10:20:30.000Z") }
    );

    await storage.putObject({
      key: "workspaces/workspace-1/generated/kp/doc-1.pdf",
      body: new Uint8Array([4, 5, 6]),
      contentType: "application/pdf"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://account.r2.cloudflarestorage.com/ai-crm-documents/workspaces/workspace-1/generated/kp/doc-1.pdf");
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toMatchObject({
      "content-type": "application/pdf",
      "x-amz-content-sha256": expect.any(String),
      "x-amz-date": "20260521T102030Z",
      authorization: expect.stringContaining("AWS4-HMAC-SHA256 Credential=access/20260521/auto/s3/aws4_request")
    });
  });
});
