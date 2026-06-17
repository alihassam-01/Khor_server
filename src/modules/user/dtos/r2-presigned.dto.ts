export interface IPresignedUrlRequestDTO {
  fileName: string;
  mimeType: string;
  fileSize: number;
  folder?: string;
}

export interface IPresignedUrlResponseDTO {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

export interface IBatchPresignedUrlRequestDTO {
  files: IPresignedUrlRequestDTO[];
}

export interface IBatchPresignedUrlResponseDTO {
  urls: IPresignedUrlResponseDTO[];
}

export interface ICompletePresignedUploadDTO {
  key: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
}

export interface ICompletePresignedUploadsDTO {
  files: ICompletePresignedUploadDTO[];
}
