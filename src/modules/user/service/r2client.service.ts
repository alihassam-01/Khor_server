import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "../../../config/config";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { S3ImagesEntity } from "../entity/images/s3Images.entity";
import { AppDataSource } from "../../../config/ormconfig";
import { In } from "typeorm";

export class R2ClientService {
  private r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
  private s3Image = AppDataSource.getRepository(S3ImagesEntity);

  /**
   * Get the R2 client instance
   */
  getR2Client() {
    return this.r2Client;
  }

  /**
   * Get the bucket name
   */
  getBucketName() {
    return config.r2.bucketName;
  }

  /**
   * Get the bucket URL (public URL for R2)
   * Note: R2_PUBLIC_URL should be your public domain (e.g., https://pub-xxx.r2.dev or custom domain)
   * configured in Cloudflare R2 bucket settings
   */
  getBucketUrl() {
    return config.r2.publicUrl;
  }

  /**
   * Upload a file to R2
   */
  uploadFileToR2 = async (
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string
  ) => {
    const extension = path.extname(originalName);
    const key = `uploads/${uuidv4()}${extension}`;
    const command = new PutObjectCommand({
      Bucket: this.getBucketName(),
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    });
    await this.r2Client.send(command);
    const url = `${this.getBucketUrl()}/${key}`;
    if (!url) {
      throw new Error("Failed to upload file to R2");
    }
    const imageEntity = this.s3Image.create({
      key,
      url,
      dateUploaded: new Date(),
      isDeleted: false,
    });
    await this.s3Image.save(imageEntity);
    return { url, key };
  };

  /**
   * Delete a file from R2
   */
  deleteFileFromR2 = async (keyOrUrl: string | string[]) => {
    let keys: string[];
    if (Array.isArray(keyOrUrl)) {
      keys = keyOrUrl.map((item) => {
        // If it's a URL, extract the key after the bucket URL
        const match = item.match(/\/([^\/]+\/[^\/]+)$/);
        return match ? match[1] : item;
      });
    } else {
      const match = keyOrUrl.match(/\/([^\/]+\/[^\/]+)$/);
      keys = [match ? match[1] : keyOrUrl];
    }
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
}
