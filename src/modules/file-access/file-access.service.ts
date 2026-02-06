import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { AuthenticatedUser } from "../../common/interfaces";
import { Readable } from "stream";
import * as crypto from "crypto";

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
  disposition?: string;
}

@Injectable()
export class FileAccessService {
  private readonly logger = new Logger(FileAccessService.name);
  private readonly proxySecret: string;
  private readonly appPort: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {
    // Use JWT_SECRET as HMAC key for proxy tokens
    this.proxySecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
    this.appPort = this.configService.get<number>('PORT') || 5000;
  }

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

    // Generate a signed proxy token (no Telegram URL exposed to client)
    const proxyToken = this.generateProxyToken(fileId, expiresIn, forDownload);
    const url = `/api/files/proxy/${proxyToken}`;

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    this.logger.log(
      `Generated proxy URL for file ${fileId} by user ${user.id}`,
    );

    return {
      url,
      publicUrl: null,
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

  // ===== Proxy token methods =====

  /**
   * Generate an HMAC-signed proxy token
   * Token format: base64url({ fileId, exp, download }) + "." + hmac_signature
   * This token allows public access to a file without exposing storage credentials
   */
  generateProxyToken(
    fileId: string,
    expiresIn: number = 3600,
    forDownload: boolean = false,
  ): string {
    const payload = {
      fid: fileId,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
      dl: forDownload ? 1 : 0,
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.proxySecret)
      .update(payloadStr)
      .digest('base64url');
    return `${payloadStr}.${signature}`;
  }

  /**
   * Verify and decode a proxy token
   * Returns the payload if valid, throws otherwise
   */
  verifyProxyToken(token: string): { fileId: string; forDownload: boolean } {
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid proxy token format');
    }

    const [payloadStr, signature] = parts;

    // Verify HMAC
    const expectedSignature = crypto
      .createHmac('sha256', this.proxySecret)
      .update(payloadStr)
      .digest('base64url');

    if (!crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )) {
      throw new ForbiddenException('Invalid proxy token signature');
    }

    // Decode payload
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenException('Proxy token has expired');
    }

    return {
      fileId: payload.fid,
      forDownload: payload.dl === 1,
    };
  }

  /**
   * Stream a file using a verified proxy token (no JWT auth needed)
   */
  async streamFileByProxyToken(
    token: string,
  ): Promise<StreamResponse> {
    const { fileId, forDownload } = this.verifyProxyToken(token);

    const file = await this.prisma.contract_document_file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const key = this.storageService.extractKeyFromUrl(file.file_url);
    const buffer = await this.storageService.getFile(key);
    const stream = Readable.from(buffer);

    const fileName = file.file_name || 'document';
    const contentType = file.mime_type || 'application/octet-stream';
    const disposition = forDownload ? 'attachment' : 'inline';

    this.logger.log(`Proxy streaming file ${fileId} (download=${forDownload})`);

    return {
      stream,
      contentType,
      contentLength: file.file_size || buffer.length,
      fileName,
      disposition,
    };
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
