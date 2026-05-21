import { createHmac, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type LocalObjectStorageConfig = {
  provider: "local";
  localDir: string;
};

export type S3ObjectStorageConfig = {
  provider: "s3";
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type ObjectStorageConfig = LocalObjectStorageConfig | S3ObjectStorageConfig;

export type PutObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export type ObjectStorage = {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(key: string): Promise<Uint8Array>;
  deleteObject(key: string): Promise<void>;
};

export type ObjectStorageFetch = (url: string, init?: RequestInit) => Promise<Response>;

type S3ObjectStorageOptions = {
  fetch?: ObjectStorageFetch;
  now?: () => Date;
};

type ObjectStorageEnv = Record<string, string | undefined>;

export function getObjectStorageConfigFromEnv(env: ObjectStorageEnv = process.env): ObjectStorageConfig {
  const provider = (env.STORAGE_PROVIDER ?? "local").toLowerCase();

  if (provider === "s3") {
    return {
      provider: "s3",
      endpoint: requireEnv(env, "S3_ENDPOINT"),
      bucket: requireEnv(env, "S3_BUCKET"),
      region: env.S3_REGION?.trim() || "auto",
      accessKeyId: requireEnv(env, "S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv(env, "S3_SECRET_ACCESS_KEY")
    };
  }

  return {
    provider: "local",
    localDir: env.LOCAL_STORAGE_DIR?.trim() || "./.local-storage"
  };
}

export function createObjectStorageFromEnv(env: ObjectStorageEnv = process.env): ObjectStorage {
  const config = getObjectStorageConfigFromEnv(env);

  return config.provider === "s3" ? createS3ObjectStorage(config) : createLocalObjectStorage(config);
}

export function createLocalObjectStorage(config: LocalObjectStorageConfig): ObjectStorage {
  const root = resolve(config.localDir);

  return {
    async putObject(input) {
      const objectPath = resolveObjectPath(root, input.key);
      await mkdir(dirname(objectPath), { recursive: true });
      await writeFile(objectPath, input.body);
    },
    async getObject(key) {
      const bytes = await readFile(resolveObjectPath(root, key));
      return new Uint8Array(bytes);
    },
    async deleteObject(key) {
      const { rm } = await import("node:fs/promises");
      await rm(resolveObjectPath(root, key), { force: true });
    }
  };
}

export function createS3ObjectStorage(config: S3ObjectStorageConfig, options: S3ObjectStorageOptions = {}): ObjectStorage {
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());

  return {
    async putObject(input) {
      const url = createObjectUrl(config, input.key);
      const date = now();
      const headers = signS3Request({
        config,
        method: "PUT",
        url,
        date,
        payload: input.body,
        extraHeaders: { "content-type": input.contentType }
      });
      const response = await fetcher(url.toString(), { method: "PUT", headers, body: toArrayBuffer(input.body) });
      await assertOk(response, "upload", input.key);
    },
    async getObject(key) {
      const url = createObjectUrl(config, key);
      const date = now();
      const headers = signS3Request({
        config,
        method: "GET",
        url,
        date,
        payload: new Uint8Array(),
        extraHeaders: {}
      });
      const response = await fetcher(url.toString(), { method: "GET", headers });
      await assertOk(response, "download", key);
      return new Uint8Array(await response.arrayBuffer());
    },
    async deleteObject(key) {
      const url = createObjectUrl(config, key);
      const date = now();
      const headers = signS3Request({
        config,
        method: "DELETE",
        url,
        date,
        payload: new Uint8Array(),
        extraHeaders: {}
      });
      const response = await fetcher(url.toString(), { method: "DELETE", headers });
      await assertOk(response, "delete", key);
    }
  };
}

function requireEnv(env: ObjectStorageEnv, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`${key} is required when STORAGE_PROVIDER=s3.`);
  }

  return value;
}

function resolveObjectPath(root: string, key: string): string {
  const objectPath = resolve(join(root, key));

  if (!objectPath.startsWith(`${root}\\`) && objectPath !== root && !objectPath.startsWith(`${root}/`)) {
    throw new Error(`Invalid storage key: ${key}`);
  }

  return objectPath;
}

function createObjectUrl(config: S3ObjectStorageConfig, key: string): URL {
  const endpoint = config.endpoint.endsWith("/") ? config.endpoint.slice(0, -1) : config.endpoint;
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return new URL(`${endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`);
}

function signS3Request({
  config,
  method,
  url,
  date,
  payload,
  extraHeaders
}: {
  config: S3ObjectStorageConfig;
  method: string;
  url: URL;
  date: Date;
  payload: Uint8Array;
  extraHeaders: Record<string, string>;
}): Record<string, string> {
  const amzDate = toAmzDate(date);
  const shortDate = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(payload);
  const headers = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.entries(headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value.trim()}\n`)
    .join("");
  const canonicalRequest = [method, url.pathname, url.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${shortDate}/${config.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = getSigningKey(config.secretAccessKey, shortDate, config.region, "s3");
  const signature = hmacHex(signingKey, stringToSign);

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

async function assertOk(response: Response, operation: string, key: string): Promise<void> {
  if (response.ok) {
    return;
  }

  throw new Error(`Object storage ${operation} failed for ${key}: ${response.status} ${response.statusText}`.trim());
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSigningKey(secretAccessKey: string, date: string, region: string, service: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
