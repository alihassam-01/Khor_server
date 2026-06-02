import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CONFIG } from "@config/config";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { S3ImagesEntity } from "@modules/user/entity/images/s3Images.entity";
import { AppDataSource } from "@config/ormconfig";
import { In, Repository } from "typeorm";
import { IPresignedUrlResponseDTO } from "@modules/user/dtos/r2-presigned.dto";
import * as crypto from 'crypto';

export class R2ClientService {
  private r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${CONFIG.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: CONFIG.r2.accessKeyId,
      secretAccessKey: CONFIG.r2.secretAccessKey,
    },
  });
  private s3Image: Repository<S3ImagesEntity> = AppDataSource.getRepository(S3ImagesEntity);

  /**
   * Get the R2 client instance
   */
  getR2Client(): S3Client {
    return this.r2Client;
  }

  /**
   * Get the bucket name
   */
  getBucketName(): string {
    return CONFIG.r2.bucketName;
  }

  /**
   * Get the bucket URL (public URL for R2)
   */
  getBucketUrl(): string {
    return CONFIG.r2.publicUrl;
  }

  /**
   * Upload a file to R2.
   *
   * Returns the public URL, the bucket key, and the `s3_image_id` of the
   * registry row. Callers (e.g. ListingMediaService) can pass `s3_image_id`
   * straight into `listing_media.s3_image_id` instead of having to look it
   * up by URL after the fact.
   *
   * The MD5 hash of the bytes is used to dedupe identical uploads — a
   * second upload of the same file just returns the existing record.
   */
  uploadFileToR2 = async (
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string,
    folder: string = "uploads"
  ): Promise<{ url: string; key: string; s3_image_id: string }> => {
    const isDev = CONFIG.env === 'development';
    const uploadFolder = isDev ? `development/${folder}` : folder;
    
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const existing = await this.s3Image.findOne({ where: { hash, isDeleted: false } });

    if (existing) {
      return { url: existing.url, key: existing.key, s3_image_id: existing.id };
    }

    // If image, process to WebP and resize; otherwise upload as-is
    let outBuffer = fileBuffer;
    let outMimetype = mimetype;
    let extension = path.extname(originalName) || '';

    if (mimetype && mimetype.startsWith('image/')) {
      try {
        const sharpModule = await import('sharp');
        const sharpFn = (sharpModule.default || sharpModule) as any;
        outBuffer = await sharpFn(fileBuffer)
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        outMimetype = 'image/webp';
        extension = '.webp';
      } catch (err: unknown) {
        console.warn('[R2] Image processing failed or sharp not installed — uploading original', err);
        outBuffer = fileBuffer;
        outMimetype = mimetype;
        extension = path.extname(originalName) || '';
      }
    }

    const key = `${uploadFolder}/${uuidv4()}${extension}`;
    const command = new PutObjectCommand({
      Bucket: this.getBucketName(),
      Key: key,
      Body: outBuffer,
      ContentType: outMimetype,
    });
    await this.r2Client.send(command);

    const url = `${this.getBucketUrl()}/${key}`;
    if (!url) {
      throw new Error("Failed to upload file to R2: URL generation failed");
    }

    const imageEntity = this.s3Image.create({
      key,
      url,
      hash,
      dateUploaded: new Date(),
      isDeleted: false,
    });
    const saved = await this.s3Image.save(imageEntity);

    return { url, key, s3_image_id: saved.id };
  };

  /**
   * Delete a file from R2
   */
  deleteFileFromR2 = async (keyOrUrl: string | string[]): Promise<{ success: boolean; message: string }> => {
    const normalizeKey = (item: string): string => {
      const publicUrl = this.getBucketUrl().replace(/\/+$/, "");
      if (item.startsWith(`${publicUrl}/`)) {
        return item.slice(publicUrl.length + 1);
      }

      try {
        const parsed = new URL(item);
        return parsed.pathname.replace(/^\/+/, "");
      } catch {
        return item.replace(/^\/+/, "");
      }
    };

    const keys = (Array.isArray(keyOrUrl) ? keyOrUrl : [keyOrUrl]).map(normalizeKey);

    const command = new DeleteObjectsCommand({
      Bucket: this.getBucketName(),
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
      },
    });
    await this.r2Client.send(command);
    await this.s3Image.update({ key: In(keys) }, { isDeleted: true });

    return { success: true, message: "File deleted successfully" };
  };

  /**
   * Generate a presigned URL for direct upload to R2
   */
  generatePresignedUrl = async (
    fileName: string,
    mimeType: string,
    folder: string = "uploads"
  ): Promise<IPresignedUrlResponseDTO> => {
    const isDev = CONFIG.env === 'development';
    const uploadFolder = isDev ? `development/${folder}` : folder;
    
    const extension = path.extname(fileName) || "";
    const key = `${uploadFolder}/${uuidv4()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.getBucketName(),
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.r2Client, command, {
      expiresIn: 600, // 10 minutes
    });

    const publicUrl = `${this.getBucketUrl()}/${key}`;

    const imageEntity = this.s3Image.create({
      key,
      url: publicUrl,
      dateUploaded: new Date(),
      isDeleted: false,
    });
    await this.s3Image.save(imageEntity);

    return { uploadUrl, key, publicUrl };
  };

  /**
   * Generate multiple presigned URLs for batch upload
   */
  generatePresignedUrls = async (
    files: Array<{ fileName: string; mimeType: string; folder?: string }>
  ): Promise<IPresignedUrlResponseDTO[]> => {
    const results: IPresignedUrlResponseDTO[] = [];
    for (const file of files) {
      const result = await this.generatePresignedUrl(
        file.fileName,
        file.mimeType,
        file.folder || "uploads"
      );
      results.push(result);
    }
    return results;
  };

  /**
   * Get the max allowed file size
   */
  getMaxFileSize(): number {
    return CONFIG.r2.maxFileSize;
  }
}
