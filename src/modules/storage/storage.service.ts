import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

export interface UploadResult {
  key: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface UploadOptions {
  folder?: string;
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
}

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;
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

  // Default max file size: 10MB
  private readonly defaultMaxSizeBytes = 10 * 1024 * 1024;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>("CLOUDFLARE_R2_ENDPOINT");
    const accessKeyId = this.configService.get<string>(
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
    );
    const secretAccessKey = this.configService.get<string>(
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    );
    this.bucketName =
      this.configService.get<string>("CLOUDFLARE_R2_BUCKET_NAME") || "";
    
    // Use R2_PUBLIC_URL if set, otherwise use endpoint
    this.publicUrl =
      this.configService.get<string>("R2_PUBLIC_URL") || 
      this.configService.get<string>("CLOUDFLARE_R2_PUBLIC_URL") ||
      endpoint || "";

    if (!endpoint || !accessKeyId) {
      this.logger.warn(
        "R2 Storage credentials not configured. File uploads will fail.",
      );
    }

    this.s3Client = new S3Client({
      region: "auto",
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId || "",
        secretAccessKey: secretAccessKey || "",
      },
    });
  }

  /**
   * Upload a single file to R2 Storage
   */
  async uploadFile(
    file: Express.Multer.File,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const {
      folder = "uploads",
      allowedMimeTypes = this.defaultAllowedMimeTypes,
      maxSizeBytes = this.defaultMaxSizeBytes,
    } = options;

    // Validate file
    this.validateFile(file, allowedMimeTypes, maxSizeBytes);

    // Generate unique filename
    const fileExtension = this.getFileExtension(file.originalname);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    try {
      // Upload to R2
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            originalName: encodeURIComponent(file.originalname),
          },
        }),
      );

      const url = this.getPublicUrl(key);

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file: ${error.message}`, error.stack);
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
    const results = await Promise.all(
      files.map((file) => this.uploadFile(file, options)),
    );
    return results;
  }

  /**
   * Delete a file from R2 Storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`, error.stack);
      throw new BadRequestException("Failed to delete file from storage");
    }
  }

  /**
   * Get file from R2 Storage
   */
  async getFile(key: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error(`Failed to get file: ${error.message}`, error.stack);
      throw new BadRequestException("Failed to get file from storage");
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

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) return "";
    return filename.substring(lastDotIndex).toLowerCase();
  }

  /**
   * Get public URL for a file (used during upload)
   */
  private getPublicUrl(key: string): string {
    // Remove bucket name from key if it's already included
    const cleanKey = key.replace(new RegExp(`^${this.bucketName}/`), '');
    
    // If you have a custom domain or public URL configured
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/$/, "")}/${cleanKey}`;
    }
    
    // Default R2 URL format - this shouldn't happen if publicUrl is set
    const endpoint = this.configService.get("CLOUDFLARE_R2_ENDPOINT");
    return `${endpoint}/${this.bucketName}/${cleanKey}`;
  }

  /**
   * Get public URL for a file key (publicly accessible method)
   * Use this when you have R2 public bucket access configured
   * @param key - The file key in R2 storage
   */
  getPublicFileUrl(key: string): string | null {
    if (!this.publicUrl) {
      return null;
    }

    // Clean the key
    let cleanKey = key;
    if (this.bucketName && cleanKey.startsWith(`${this.bucketName}/`)) {
      cleanKey = cleanKey.substring(this.bucketName.length + 1);
    }
    cleanKey = cleanKey.replace(/^\//, "");

    return `${this.publicUrl.replace(/\/$/, "")}/${cleanKey}`;
  }

  /**
   * Check if public URL is configured
   */
  hasPublicUrl(): boolean {
    return !!this.publicUrl;
  }

  /**
   * Generate folder path for contract documents
   */
  generateContractDocumentPath(
    contractId: string,
    documentRequirementId: string,
  ): string {
    return `contracts/${contractId}/documents/${documentRequirementId}`;
  }

  /**
   * Generate folder path for user documents (KYC, etc.)
   */
  generateUserDocumentPath(userId: string, documentType: string): string {
    return `users/${userId}/${documentType}`;
  }

  /**
   * Generate folder path for withdrawal proofs
   */
  generateWithdrawalProofPath(withdrawalId: string): string {
    return `withdrawals/${withdrawalId}/proofs`;
  }

  /**
   * Generate a presigned URL for secure file access
   * This allows temporary access to private files without exposing credentials
   * @param key - The file key in R2 storage
   * @param expiresIn - URL expiration time in seconds (default: 1 hour, max: 7 days)
   * @param options - Additional options like download filename
   */
  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    options?: { downloadFilename?: string },
  ): Promise<string> {
    try {
      // Clean the key - remove bucket name prefix if present
      let cleanKey = key;
      if (this.bucketName && cleanKey.startsWith(`${this.bucketName}/`)) {
        cleanKey = cleanKey.substring(this.bucketName.length + 1);
      }
      // Remove leading slash if present
      cleanKey = cleanKey.replace(/^\//, "");

      this.logger.debug(`Generating signed URL for key: ${cleanKey}`);

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: cleanKey,
        ...(options?.downloadFilename && {
          ResponseContentDisposition: `attachment; filename="${encodeURIComponent(options.downloadFilename)}"`,
        }),
      });

      // Max expiration is 7 days (604800 seconds)
      const maxExpiration = 7 * 24 * 60 * 60;
      const validExpiration = Math.min(expiresIn, maxExpiration);

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: validExpiration,
      });

      this.logger.log(`Generated signed URL for key: ${cleanKey}`);
      return signedUrl;
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException("Failed to generate file access URL");
    }
  }

  /**
   * Get file metadata (size, content type, etc.)
   * @param key - The file key in R2 storage
   */
  async getFileMetadata(key: string): Promise<{
    contentType: string;
    contentLength: number;
    lastModified?: Date;
  }> {
    try {
      const cleanKey = key.replace(new RegExp(`^${this.bucketName}/`), "");

      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );

      return {
        contentType: response.ContentType || "application/octet-stream",
        contentLength: response.ContentLength || 0,
        lastModified: response.LastModified,
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
   * Check if a file exists in storage
   * @param key - The file key in R2 storage
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const cleanKey = key.replace(new RegExp(`^${this.bucketName}/`), "");
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get file as a readable stream (useful for proxying downloads)
   * @param key - The file key in R2 storage
   */
  async getFileStream(key: string): Promise<{
    stream: ReadableStream | null;
    contentType: string;
    contentLength: number;
  }> {
    try {
      const cleanKey = key.replace(new RegExp(`^${this.bucketName}/`), "");

      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: cleanKey,
        }),
      );

      return {
        stream: response.Body?.transformToWebStream() || null,
        contentType: response.ContentType || "application/octet-stream",
        contentLength: response.ContentLength || 0,
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
   * Extract storage key from file URL
   * @param url - The full file URL stored in database
   */
  extractKeyFromUrl(url: string): string {
    if (!url) {
      throw new BadRequestException("Invalid file URL");
    }

    try {
      // If URL is already a key (no protocol)
      if (!url.includes("://")) {
        return url;
      }

      const urlObj = new URL(url);
      // Remove leading slash from pathname
      let key = urlObj.pathname.replace(/^\//, "");

      // Handle R2 subdomain-style URLs (bucket.account.r2.cloudflarestorage.com)
      // The hostname already contains bucket name, so pathname is the key
      if (urlObj.hostname.includes(".r2.cloudflarestorage.com")) {
        // Key is just the pathname without leading slash
        return key;
      }

      // Handle path-style URLs (endpoint/bucket/key)
      // Remove bucket name prefix if present
      if (this.bucketName && key.startsWith(`${this.bucketName}/`)) {
        key = key.substring(this.bucketName.length + 1);
      }

      return key;
    } catch (error) {
      this.logger.error(`Failed to extract key from URL: ${url}`);
      throw new BadRequestException("Invalid file URL format");
    }
  }
}
