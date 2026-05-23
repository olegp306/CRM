import { NextResponse } from "next/server";
import { createObjectStorageFromEnv } from "@app/core/storage";
import { prisma } from "@app/db";
import { getWorkspaceSession } from "../../../../workspace-session";

export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await getWorkspaceSession();
  const { attachmentId } = await params;
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      workspaceId: session.workspaceId
    }
  });

  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  try {
    const bytes = await createObjectStorageFromEnv().getObject(attachment.storageKey);
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : attachment.mimeType === "application/pdf" ? "inline" : "attachment";
    return new Response(toArrayBuffer(bytes), {
      headers: {
        "content-type": attachment.mimeType,
        "content-disposition": `${disposition}; filename="${createDownloadFileName(request, attachment.fileName)}"`,
        "cache-control": "private, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ error: "Attachment file is not available yet" }, { status: 404 });
  }
}

function createDownloadFileName(request: Request, fallback: string): string {
  const filename = new URL(request.url).searchParams.get("filename")?.trim();
  if (!filename) {
    return fallback;
  }

  return filename
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
