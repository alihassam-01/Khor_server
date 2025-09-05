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

export class S3ClientService {
  private s3 = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  private s3Image = AppDataSource.getRepository(S3ImagesEntity);
  /**
   * Get the S3 client instance
   */
  getS3Client() {
    return this.s3;
  }

  /**
   * Get the bucket name
   */
  getBucketName() {
    return config.aws.bucketName;
  }

  /**
   * Get the bucket URL
   */
  getBucketUrl() {
    return `https://${this.getBucketName()}.s3.${
      config.aws.region
    }.amazonaws.com`;
  }

  /**
   * Upload a file to S3
   */
  uploadFileToS3 = async (
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
    await this.s3.send(command);
    const url = `${this.getBucketUrl()}/${key}`;
    if (!url) {
      throw new Error("Failed to upload file to S3");
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
   * Delete a file from S3
   */
  deleteFileFromS3 = async (keyOrUrl: string | string[]) => {
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
    await this.s3.send(command);
    await this.s3Image.update({ key: In(keys) }, { isDeleted: true });
    return { success: true, message: "File deleted successfully" };
  };
}
