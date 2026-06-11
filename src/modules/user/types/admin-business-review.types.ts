import {
    BusinessCapabilityStatus,
    BusinessCapabilityType,
    BusinessOnboardingStatus,
} from "@common/enums/business.enums";
import { IBusinessDocumentDto } from "./business-documents.types";

export interface IAdminBusinessCapabilityDto {
    id?: string;
    type: BusinessCapabilityType;
    status: BusinessCapabilityStatus;
    reviewNote?: string | null;
    approvedAt?: string | null;
}

export interface IAdminBusinessSummaryDto {
    id: string;
    businessProfileId?: string | null;
    userId: string;
    email: string;
    username: string;
    ownerLegalName?: string | null;
    businessName?: string | null;
    phoneNumber?: string | null;
    cityId?: number | null;
    businessAddress?: string | null;
    googleMapsUrl?: string | null;
    isLegacy: boolean;
    isActive: boolean;
    isVerified: boolean;
    onboardingStatus: BusinessOnboardingStatus;
    reviewNote?: string | null;
    createdAt: string;
    capabilities: IAdminBusinessCapabilityDto[];
    documents?: IBusinessDocumentDto[];
    currentPolicyAccepted?: boolean;
    acceptedPolicyVersion?: string | null;
}

export interface IReviewBusinessProfileDto {
    status: BusinessOnboardingStatus;
    note?: string;
}

export interface IReviewBusinessCapabilityDto {
    action: "approve" | "reject" | "suspend";
    note?: string;
}
