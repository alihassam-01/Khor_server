export interface IPresignedUrlRequestDTO {
  fileName: string;
  mimeType: string;
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
