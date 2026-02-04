import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  StreamableFile,
  Header,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../rbac/guards/permissions.guard";
import { Permissions, CurrentUser } from "../../common/decorators";
import { AuthenticatedUser } from "../../common/interfaces";
import { FileAccessService } from "./file-access.service";

@ApiTags("File Access")
@ApiBearerAuth("JWT-auth")
@Controller("files")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FileAccessController {
  constructor(private readonly fileAccessService: FileAccessService) {}

  /**
   * Get a presigned URL for a document file
   * This is the preferred method for viewing images or downloading files
   */
  @Get("documents/:fileId/url")
  @Permissions("document:read", "contract:read")
  @ApiOperation({
    summary: "Get presigned URL for a document file",
    description:
      "Returns a temporary signed URL that allows direct access to the file. URL expires after specified duration.",
  })
  @ApiParam({ name: "fileId", description: "Document file ID" })
  @ApiQuery({
    name: "expiresIn",
    required: false,
    type: Number,
    description: "URL expiration time in seconds (default: 3600, max: 604800)",
    example: 3600,
  })
  @ApiQuery({
    name: "download",
    required: false,
    type: Boolean,
    description: "If true, sets Content-Disposition to attachment for download",
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: "Returns presigned URL and public URL (if configured)",
    schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Presigned URL (always works)" },
        publicUrl: { type: "string", nullable: true, description: "Public URL (if R2 public access is configured)" },
        expiresAt: { type: "string", format: "date-time" },
        fileName: { type: "string" },
        mimeType: { type: "string" },
        fileSize: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "File not found" })
  @ApiResponse({ status: 403, description: "Not authorized to access this file" })
  async getDocumentFileUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fileId") fileId: string,
    @Query("expiresIn") expiresIn?: number,
    @Query("download") download?: boolean,
  ) {
    return this.fileAccessService.getDocumentFileUrl(
      fileId,
      user,
      expiresIn || 3600,
      download,
    );
  }

  /**
   * Stream file directly through the server
   * Use this for embedding images or when presigned URLs don't work
   */
  @Get("documents/:fileId/stream")
  @Permissions("document:read", "contract:read")
  @ApiOperation({
    summary: "Stream a document file directly",
    description:
      "Streams the file through the server. Use this when presigned URLs are not suitable.",
  })
  @ApiParam({ name: "fileId", description: "Document file ID" })
  @ApiResponse({ status: 200, description: "File stream" })
  @ApiResponse({ status: 404, description: "File not found" })
  @ApiResponse({ status: 403, description: "Not authorized to access this file" })
  async streamDocumentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fileId") fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType, contentLength, fileName } =
      await this.fileAccessService.streamDocumentFile(fileId, user);

    res.set({
      "Content-Type": contentType,
      "Content-Length": contentLength,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    });

    return new StreamableFile(stream);
  }

  /**
   * Download file with proper filename
   */
  @Get("documents/:fileId/download")
  @Permissions("document:read", "contract:read")
  @ApiOperation({
    summary: "Download a document file",
    description: "Downloads the file with proper filename attachment header.",
  })
  @ApiParam({ name: "fileId", description: "Document file ID" })
  @ApiResponse({ status: 200, description: "File download" })
  @ApiResponse({ status: 404, description: "File not found" })
  @ApiResponse({ status: 403, description: "Not authorized to access this file" })
  async downloadDocumentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("fileId") fileId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType, contentLength, fileName } =
      await this.fileAccessService.streamDocumentFile(fileId, user);

    res.set({
      "Content-Type": contentType,
      "Content-Length": contentLength,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    return new StreamableFile(stream);
  }

  /**
   * Get multiple presigned URLs at once (batch operation)
   * Useful when loading many files at once
   */
  @Get("documents/batch-urls")
  @Permissions("document:read", "contract:read")
  @ApiOperation({
    summary: "Get presigned URLs for multiple files",
    description: "Returns presigned URLs for multiple files in a single request",
  })
  @ApiQuery({
    name: "fileIds",
    description: "Comma-separated list of file IDs",
    example: "file1,file2,file3",
  })
  @ApiQuery({
    name: "expiresIn",
    required: false,
    type: Number,
    description: "URL expiration time in seconds",
    example: 3600,
  })
  @ApiResponse({
    status: 200,
    description: "Returns map of file IDs to presigned URLs",
    schema: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          url: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          fileName: { type: "string" },
        },
      },
    },
  })
  async getBatchDocumentUrls(
    @CurrentUser() user: AuthenticatedUser,
    @Query("fileIds") fileIds: string,
    @Query("expiresIn") expiresIn?: number,
  ) {
    const ids = fileIds.split(",").filter(Boolean);
    return this.fileAccessService.getBatchDocumentUrls(
      ids,
      user,
      expiresIn || 3600,
    );
  }
}

/**
 * Public file access controller for files that don't require authentication
 * Only use this for truly public files
 */
@ApiTags("File Access")
@Controller("public/files")
export class PublicFileAccessController {
  constructor(private readonly fileAccessService: FileAccessService) {}

  /**
   * This endpoint can be used for public file access if needed
   * For now, it's disabled - all files require authentication
   */
  // @Get(':token')
  // @ApiOperation({ summary: 'Access file via temporary token' })
  // async accessFileByToken(@Param('token') token: string) {
  //   return this.fileAccessService.accessFileByToken(token);
  // }
}
