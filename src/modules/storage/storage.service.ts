import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import * as FormData from "form-data";

export interface UploadResult {
  key: string; // Telegram file_id
  url: string; // telegram:// reference stored in DB
  fileName: string;
  fileSize: number;
  mimeType: string;
  messageId?: number; // Telegram message ID in channel
}

export interface UploadOptions {
  folder?: string; // Used as caption prefix for organization
  caption?: string; // Custom caption for the file in Telegram
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
}

@Injectable()
export class StorageService {
  private readonly botToken: string;
  private readonly channelId: string;
  private readonly baseUrl: string;
  private readonly logger = new Logger(StorageService.name);

  // Default allowed MIME types for documents
  private readonly defaultAllowedMimeTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  // Default max file size: 20MB (Telegram Bot API limit for sendDocument)
  private readonly defaultMaxSizeBytes = 20 * 1024 * 1024;

  constructor(private readonly configService: ConfigService) {
    this.botToken =
      this.configService.get<string>("TELEGRAM_BOT_TOKEN") || "";
    this.channelId =
      this.configService.get<string>("TELEGRAM_CHANNEL_ID") || "";
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;

    if (!this.botToken || !this.channelId) {
      this.logger.warn(
        "Telegram Bot credentials not configured. File uploads will fail.",
      );
    }
  }

  /**
   * Upload a single file to Telegram channel
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const {
      folder = "uploads",
      caption,
      allowedMimeTypes = this.defaultAllowedMimeTypes,
      maxSizeBytes = this.defaultMaxSizeBytes,
    } = options;

    // Validate file
    this.validateFile(file, allowedMimeTypes, maxSizeBytes);

    // Build caption: folder/originalname for organization
    const fileCaption = caption || `${folder}/${file.originalname}`;

    try {
      const formData = new FormData();
      formData.append("chat_id", this.channelId);
      formData.append("caption", fileCaption);

      // Always use sendDocument to preserve original file quality & name
      formData.append("document", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await axios.post(
        `${this.baseUrl}/sendDocument`,
        formData,
        {
          headers: formData.getHeaders(),
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      if (!response.data.ok) {
        throw new Error(
          `Telegram API error: ${response.data.description || "Unknown error"}`,
        );
      }

      const message = response.data.result;
      const messageId = message.message_id;

      // Extract file_id from the response
      let fileId: string;
      if (message.document) {
        fileId = message.document.file_id;
      } else if (message.photo) {
        // Get the largest photo size
        fileId = message.photo[message.photo.length - 1].file_id;
      } else {
        throw new Error("No file_id in Telegram response");
      }

      // Store as telegram://file_id format for easy identification
      const url = `telegram://${fileId}?message_id=${messageId}`;

      this.logger.log(
        `File uploaded to Telegram: ${file.originalname} -> message_id=${messageId}, file_id=${fileId}`,
      );

      return {
        key: fileId,
        url,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        messageId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload file to Telegram: ${error.message}`,
        error.stack,
      );
      if (error.response?.data) {
        this.logger.error(
          `Telegram API response: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new BadRequestException("Failed to upload file to storage");
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    files: Express.Multer.File[],
    options: UploadOptions = {},
  ): Promise<UploadResult[]> {
    // Upload sequentially to avoid Telegram rate limits
    const results: UploadResult[] = [];
    for (const file of files) {
      const result = await this.uploadFile(file, options);
      results.push(result);
      // Small delay between uploads to avoid rate limiting
      if (files.length > 1) {
        await this.delay(100);
      }
    }
    return results;
  }

  /**
   * Delete a file from Telegram channel (delete the message)
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const messageId = this.extractMessageIdFromKey(key);

      if (messageId) {
        await axios.post(`${this.baseUrl}/deleteMessage`, {
          chat_id: this.channelId,
          message_id: messageId,
        });
        this.logger.log(
          `File message deleted from Telegram: message_id=${messageId}`,
        );
      } else {
        this.logger.warn(
          `Cannot delete file from Telegram: no message_id found for key=${key}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete file from Telegram: ${error.message}`,
        error.stack,
      );
      // Don't throw - deletion failure shouldn't break the flow
    }
  }

  /**
   * Get file from Telegram as Buffer
   */
  async getFile(key: string): Promise<Buffer> {
    try {
      const fileId = this.extractFileId(key);

      // Step 1: Get file path from Telegram
      const fileInfoResponse = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`,
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error(
          `Telegram getFile error: ${fileInfoResponse.data.description}`,
        );
      }

      const filePath = fileInfoResponse.data.result.file_path;

      // Step 2: Download file from Telegram file server
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
      const fileResponse = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
      });

      return Buffer.from(fileResponse.data);
    } catch (error) {
      this.logger.error(
        `Failed to get file from Telegram: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("Failed to get file from storage");
    }
  }

  /**
   * Generate a temporary download URL for a file via Telegram
   * Telegram file URLs are valid for at least 1 hour
   */
  async getSignedUrl(
    key: string,
    _expiresIn: number = 3600,
    _options?: { downloadFilename?: string },
  ): Promise<string> {
    try {
      const fileId = this.extractFileId(key);

      // Get file path from Telegram
      const fileInfoResponse = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`,
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error(
          `Telegram getFile error: ${fileInfoResponse.data.description}`,
        );
      }

      const filePath = fileInfoResponse.data.result.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

      this.logger.log(`Generated download URL for file_id: ${fileId}`);
      return downloadUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate download URL: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("Failed to generate file access URL");
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    contentType: string;
    contentLength: number;
    lastModified?: Date;
  }> {
    try {
      const fileId = this.extractFileId(key);

      const fileInfoResponse = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`,
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error(
          `Telegram getFile error: ${fileInfoResponse.data.description}`,
        );
      }

      const fileInfo = fileInfoResponse.data.result;

      return {
        contentType: this.getMimeTypeFromPath(fileInfo.file_path || ""),
        contentLength: fileInfo.file_size || 0,
        lastModified: undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get file metadata: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("File not found or inaccessible");
    }
  }

  /**
   * Check if a file exists in Telegram storage
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const fileId = this.extractFileId(key);
      const response = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`,
      );
      return response.data.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Get file as a readable stream
   */
  async getFileStream(key: string): Promise<{
    stream: ReadableStream | null;
    contentType: string;
    contentLength: number;
  }> {
    try {
      const fileId = this.extractFileId(key);

      const fileInfoResponse = await axios.get(
        `${this.baseUrl}/getFile?file_id=${fileId}`,
      );

      if (!fileInfoResponse.data.ok) {
        throw new Error(
          `Telegram getFile error: ${fileInfoResponse.data.description}`,
        );
      }

      const fileInfo = fileInfoResponse.data.result;
      const filePath = fileInfo.file_path;
      const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;

      const response = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);
      const blob = new Blob([buffer]);
      const stream = blob.stream() as unknown as ReadableStream;

      return {
        stream,
        contentType: this.getMimeTypeFromPath(filePath || ""),
        contentLength: fileInfo.file_size || buffer.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get file stream: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("Failed to access file");
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(
    file: Express.Multer.File,
    allowedMimeTypes: string[],
    maxSizeBytes: number,
  ): void {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${allowedMimeTypes.join(", ")}`,
      );
    }

    if (file.size > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      );
    }
  }

  // ===== Path generation helpers (kept for caption/organization) =====

  generateContractDocumentPath(
    contractId: string,
    documentRequirementId: string,
  ): string {
    return `contracts/${contractId}/documents/${documentRequirementId}`;
  }

  generateUserDocumentPath(userId: string, documentType: string): string {
    return `users/${userId}/${documentType}`;
  }

  generateWithdrawalProofPath(withdrawalId: string): string {
    return `withdrawals/${withdrawalId}/proofs`;
  }

  // ===== URL/Key extraction helpers =====

  /**
   * Extract file_id from stored URL or key
   * Supports formats:
   *   - telegram://FILE_ID?message_id=123
   *   - FILE_ID (raw)
   *   - Legacy R2 URLs (will throw)
   */
  extractKeyFromUrl(url: string): string {
    return this.extractFileId(url);
  }

  /**
   * Get public URL for a file key
   * For Telegram, there is no persistent public URL
   */
  getPublicFileUrl(_key: string): string | null {
    return null;
  }

  /**
   * Check if public URL is configured
   */
  hasPublicUrl(): boolean {
    return false;
  }

  // ===== Private helpers =====

  private extractFileId(urlOrKey: string): string {
    if (!urlOrKey) {
      throw new BadRequestException("Invalid file reference");
    }

    // telegram://FILE_ID?message_id=123
    if (urlOrKey.startsWith("telegram://")) {
      const withoutScheme = urlOrKey.substring("telegram://".length);
      const questionIdx = withoutScheme.indexOf("?");
      return questionIdx > -1
        ? withoutScheme.substring(0, questionIdx)
        : withoutScheme;
    }

    // Already a raw file_id (no protocol)
    if (!urlOrKey.includes("://")) {
      return urlOrKey;
    }

    // Legacy R2 URL
    this.logger.warn(
      `Encountered non-Telegram URL: ${urlOrKey}. File may be from old R2 storage.`,
    );
    throw new BadRequestException(
      "This file was stored in the old storage system and is no longer accessible. Please re-upload.",
    );
  }

  private extractMessageIdFromKey(urlOrKey: string): number | null {
    if (urlOrKey.startsWith("telegram://")) {
      const match = urlOrKey.match(/message_id=(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }
    return null;
  }

  private getMimeTypeFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return mimeMap[ext || ""] || "application/octet-stream";
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
