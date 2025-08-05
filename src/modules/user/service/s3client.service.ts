import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "@config/config";
import { v4 as uuidv4 } from "uuid";
import path from "path";

export class S3ClientService {
  private s3 = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });

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
    return `https://${this.getBucketName()}.s3.${config.aws.region}.amazonaws.com`;
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
      ACL: "public-read", // remove this if you're using private buckets
    });
    await this.s3.send(command);
    const url = `${this.getBucketUrl()}/${key}`;
    console.log("File URL:", url);
    return { url, key };
  };
}
