import {
    BusinessDocumentStatus,
    BusinessDocumentType,
} from "@common/enums/business.enums";

export interface IBusinessDocumentDto {
    id: string;
    documentType: BusinessDocumentType;
    originalFileName: string;
    key: string;
    publicUrl: string;
    mimeType: string;
    sizeBytes: number;
    status: BusinessDocumentStatus;
    reviewNote?: string | null;
    uploadedAt?: string | null;
    createdAt: string;
}

export interface IBusinessDocumentPresignRequestDto {
    documentType: BusinessDocumentType;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
}

export interface IBusinessDocumentPresignResponseDto extends IBusinessDocumentDto {
    uploadUrl: string;
    maxFileSize: number;
}

export interface ICompleteBusinessDocumentUploadDto {
    documentId: string;
    key: string;
    publicUrl: string;
}

export interface IAcceptCurrentPolicyDto {
    policyType: string;
    policyVersion: string;
    contentHash: string;
}
