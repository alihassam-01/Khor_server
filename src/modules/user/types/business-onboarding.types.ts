import {
    BusinessCapabilityType,
    BusinessOnboardingStatus,
    PartnerAccessStatus,
} from "@common/enums/business.enums";
import { IBusinessDocumentDto } from "./business-documents.types";

export interface IBusinessProfileUpsertDto {
    ownerLegalName?: string;
    businessName?: string;
    phoneNumber?: string;
    whatsappNumber?: string;
    cityId?: number | null;
    businessAddress?: string;
    googleMapsUrl?: string;
    dtsLicenseNumber?: string;
    whatsappBookingEnabled?: boolean;
    requestedCapabilities?: BusinessCapabilityType[];
}

export interface ISubmitBusinessProfileForReviewDto {
    agreementAccepted?: boolean;
    agreement_accepted?: boolean;
}

export interface IBusinessCapabilityResponseDto {
    id: string;
    type: BusinessCapabilityType;
    status: string;
    reviewNote?: string | null;
}

export interface IBusinessProfileResponseDto {
    id: string;
    userId: string;
    ownerLegalName?: string | null;
    businessName?: string | null;
    phoneNumber?: string | null;
    whatsappNumber?: string | null;
    cityId?: number | null;
    businessAddress?: string | null;
    googleMapsUrl?: string | null;
    dtsLicenseNumber?: string | null;
    whatsappBookingEnabled: boolean;
    onboardingStatus: BusinessOnboardingStatus;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    reviewNote?: string | null;
    capabilities: IBusinessCapabilityResponseDto[];
    documents: IBusinessDocumentDto[];
    currentPolicyAccepted: boolean;
    acceptedPolicyVersion?: string | null;
}

export interface IPartnerCurrentUserState {
    partnerAccessStatus: PartnerAccessStatus;
    businessProfileId?: string;
    onboardingStatus?: BusinessOnboardingStatus;
    approvedCapabilities: BusinessCapabilityType[];
}
