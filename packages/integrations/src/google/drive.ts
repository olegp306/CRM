export type DriveExportRequest = {
  workspaceId: string;
  attachmentId: string;
  fileName: string;
  parentFolderId?: string;
};

export async function exportAttachmentToDrive(request: DriveExportRequest): Promise<{ driveFileId: string }> {
  throw new Error(`Google Drive export is not connected yet for attachment ${request.attachmentId}`);
}
