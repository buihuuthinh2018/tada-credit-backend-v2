import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { AuthenticatedUser } from "../../common/interfaces";
import { Readable } from "stream";

export interface FileUrlResponse {
  url: string;
  publicUrl: string | null;
  expiresAt: Date;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface StreamResponse {
  stream: Readable;
  contentType: string;
  contentLength: number;
  fileName: string;
}

@Injectable()
export class FileAccessService {
  private readonly logger = new Logger(FileAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Get presigned URL for a document file
   * Includes authorization check
   * Returns both presigned URL (for private access) and public URL (if configured)
   */
  async getDocumentFileUrl(
    fileId: string,
    user: AuthenticatedUser,
    expiresIn: number = 3600,
    forDownload: boolean = false,
  ): Promise<FileUrlResponse> {
    const file = await this.getFileWithAuthorization(fileId, user);

    // Extract storage key from URL
    const key = this.storageService.extractKeyFromUrl(file.file_url);

    // Generate presigned URL (always works, even for private buckets)
    const url = await this.storageService.getSignedUrl(key, expiresIn, {
      downloadFilename: forDownload ? file.file_name || undefined : undefined,
    });

    // Get public URL if configured (works only if bucket has public access)
    const publicUrl = this.storageService.getPublicFileUrl(key);

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    this.logger.log(
      `Generated URLs for file ${fileId} by user ${user.id}`,
    );

    return {
      url,
      publicUrl,
      expiresAt,
      fileName: file.file_name || "document",
      mimeType: file.mime_type || "application/octet-stream",
      fileSize: file.file_size || 0,
    };
  }

  /**
   * Stream a document file through the server
   */
  async streamDocumentFile(
    fileId: string,
    user: AuthenticatedUser,
  ): Promise<StreamResponse> {
    const file = await this.getFileWithAuthorization(fileId, user);

    // Extract storage key from URL
    const key = this.storageService.extractKeyFromUrl(file.file_url);

    // Get file buffer
    const buffer = await this.storageService.getFile(key);

    // Convert buffer to readable stream
    const stream = Readable.from(buffer);

    this.logger.log(`Streaming file ${fileId} for user ${user.id}`);

    return {
      stream,
      contentType: file.mime_type || "application/octet-stream",
      contentLength: file.file_size || buffer.length,
      fileName: file.file_name || "document",
    };
  }

  /**
   * Get presigned URLs for multiple files at once
   */
  async getBatchDocumentUrls(
    fileIds: string[],
    user: AuthenticatedUser,
    expiresIn: number = 3600,
  ): Promise<Record<string, FileUrlResponse | { error: string }>> {
    const results: Record<string, FileUrlResponse | { error: string }> = {};

    // Process in parallel for performance
    await Promise.all(
      fileIds.map(async (fileId) => {
        try {
          results[fileId] = await this.getDocumentFileUrl(
            fileId,
            user,
            expiresIn,
          );
        } catch (error) {
          results[fileId] = {
            error: error.message || "Failed to get file URL",
          };
        }
      }),
    );

    return results;
  }

  /**
   * Get file record with authorization check
   */
  private async getFileWithAuthorization(
    fileId: string,
    user: AuthenticatedUser,
  ) {
    // Find file with related data for authorization
    const file = await this.prisma.contract_document_file.findUnique({
      where: { id: fileId },
      include: {
        document: {
          include: {
            contract: {
              select: {
                id: true,
                user_id: true,
              },
            },
          },
        },
      },
    });

    if (!file) {
      throw new NotFoundException("File not found");
    }

    // Check authorization
    const isOwner = file.document.contract.user_id === user.id;
    const isAdmin = this.hasAdminAccess(user);

    if (!isOwner && !isAdmin) {
      this.logger.warn(
        `Unauthorized file access attempt: file=${fileId}, user=${user.id}`,
      );
      throw new ForbiddenException("Not authorized to access this file");
    }

    return file;
  }

  /**
   * Check if user has admin-level access to documents
   */
  private hasAdminAccess(user: AuthenticatedUser): boolean {
    // Check if user has any admin permissions
    const adminPermissions = [
      "document:read",
      "contract:read",
      "admin:*",
      "*:*",
    ];

    return user.permissions?.some(
      (p) =>
        adminPermissions.includes(p) ||
        p.startsWith("document:") ||
        p.startsWith("contract:") ||
        p.startsWith("admin:"),
    );
  }
}
