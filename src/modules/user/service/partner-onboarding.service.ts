import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import {
    BusinessCapabilityStatus,
    BusinessCapabilityType,
    BusinessOnboardingStatus,
} from "@common/enums/business.enums";
import { validateDocumentUpload } from "@common/utils/upload-policy.util";
import { LocationType } from "@common/enums/location.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { BusinessProfile } from "@modules/user/entity/user/business-profile.entity";
import { BusinessCapability } from "@modules/user/entity/user/business-capability.entity";
import { BusinessDocument } from "@modules/user/entity/user/business-document.entity";
import { PolicyAcceptance } from "@modules/user/entity/user/policy-acceptance.entity";
import { Location } from "@modules/user/entity/location";
import { AppDataSource } from "@config/ormconfig";
import { EntityManager } from "typeorm";
import { R2ClientService } from "./r2client.service";
import { VendorPolicyService } from "./vendor-policy.service";
import {
    IBusinessCapabilityResponseDto,
    IBusinessProfileResponseDto,
    IBusinessProfileUpsertDto,
    ISubmitBusinessProfileForReviewDto,
} from "@modules/user/types/business-onboarding.types";
import {
    IAcceptCurrentPolicyDto,
    IBusinessDocumentDto,
    IBusinessDocumentPresignRequestDto,
    IBusinessDocumentPresignResponseDto,
    ICompleteBusinessDocumentUploadDto,
} from "@modules/user/types/business-documents.types";
import {
    BusinessDocumentStatus,
    BusinessDocumentType,
} from "@common/enums/business.enums";

const EDITABLE_CAPABILITY_STATUSES = new Set<BusinessCapabilityStatus>([
    BusinessCapabilityStatus.DRAFT,
    BusinessCapabilityStatus.REJECTED,
]);

export class PartnerOnboardingService {
    private readonly userRepository = AppDataSource.getRepository(User);
    private readonly businessProfileRepository = AppDataSource.getRepository(BusinessProfile);
    private readonly locationRepository = AppDataSource.getRepository(Location);
    private readonly businessDocumentRepository = AppDataSource.getRepository(BusinessDocument);
    private readonly policyAcceptanceRepository = AppDataSource.getRepository(PolicyAcceptance);
    private readonly r2ClientService = new R2ClientService();
    private readonly vendorPolicyService = new VendorPolicyService();

    private normalizeOptional(value?: string | null): string | null {
        const normalized = value?.trim();
        return normalized ? normalized : null;
    }

    private validatePhone(phone?: string | null): string | null {
        const normalized = this.normalizeOptional(phone);
        if (!normalized) return null;
        if (!/^\+?[0-9\s-]{7,}$/.test(normalized)) {
            throw new AppError(
                "Phone number must contain only digits, spaces, hyphens and an optional leading +",
                400,
                ErrorCodes.VALIDATION_ERROR,
            );
        }
        return normalized;
    }

    private validateGoogleMapsUrl(value?: string | null): string | null {
        const normalized = this.normalizeOptional(value);
        if (!normalized) return null;
        let parsed: URL;
        try {
            parsed = new URL(normalized);
        } catch {
            throw new AppError("Google Maps link must be a valid URL.", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const host = parsed.hostname.toLowerCase();
        const looksLikeMaps = host.includes("google.") || host.includes("goo.gl");
        if (!looksLikeMaps) {
            throw new AppError("Google Maps link must point to a Google Maps URL.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        return normalized;
    }

    private async assertCity(cityId?: number | null): Promise<void> {
        if (!cityId) return;
        const city = await this.locationRepository.findOne({
            where: {
                location_id: cityId,
                is_deleted: false,
                location_type: LocationType.CITY,
            },
        });
        if (!city) {
            throw new AppError("Selected city is invalid.", 400, ErrorCodes.VALIDATION_ERROR);
        }
    }

    private mapCapability(capability: BusinessCapability): IBusinessCapabilityResponseDto {
        return {
            id: capability.id,
            type: capability.type,
            status: capability.status,
            reviewNote: capability.review_note ?? null,
        };
    }

    private mapDocument(document: BusinessDocument): IBusinessDocumentDto {
        return {
            id: document.id,
            documentType: document.document_type,
            originalFileName: document.original_file_name,
            key: document.storage_key,
            publicUrl: document.public_url,
            mimeType: document.mime_type,
            sizeBytes: Number(document.size_bytes),
            status: document.status,
            reviewNote: document.review_note ?? null,
            uploadedAt: document.uploaded_at?.toISOString() ?? null,
            createdAt: document.created_at.toISOString(),
        };
    }

    private requiredDocumentTypes(): BusinessDocumentType[] {
        return [
            BusinessDocumentType.CNIC_FRONT,
            BusinessDocumentType.CNIC_BACK,
            BusinessDocumentType.OWNERSHIP_PROOF,
        ];
    }

    private async ensureBusinessProfile(userId: string): Promise<BusinessProfile> {
        let profile = await this.businessProfileRepository.findOne({
            where: { user_id: userId },
        });
        if (profile) return profile;
        profile = this.businessProfileRepository.create({
            user_id: userId,
            onboarding_status: BusinessOnboardingStatus.DRAFT,
        });
        return this.businessProfileRepository.save(profile);
    }

    private async loadAcceptedPolicy(profileId: string): Promise<PolicyAcceptance | null> {
        return this.policyAcceptanceRepository.findOne({
            where: {
                business_profile_id: profileId,
                policy_type: "vendor_terms",
            },
            order: { accepted_at: "DESC" },
        });
    }

    private mapProfile(profile: BusinessProfile): IBusinessProfileResponseDto {
        const acceptedCurrent = (profile as BusinessProfile & { acceptedPolicies?: PolicyAcceptance[] }).acceptedPolicies?.[0] ?? null;
        return {
            id: profile.id,
            userId: profile.user_id,
            ownerLegalName: profile.owner_legal_name ?? null,
            businessName: profile.business_name ?? null,
            phoneNumber: profile.phone_number ?? null,
            whatsappNumber: profile.whatsapp_number ?? null,
            cityId: profile.city_id ?? null,
            businessAddress: profile.business_address ?? null,
            googleMapsUrl: profile.google_maps_url ?? null,
            onboardingStatus: profile.onboarding_status,
            submittedAt: profile.submitted_at?.toISOString() ?? null,
            reviewedAt: profile.reviewed_at?.toISOString() ?? null,
            reviewNote: profile.review_note ?? null,
            capabilities: (profile.capabilities ?? []).map((capability) => this.mapCapability(capability)),
            documents: ((profile as BusinessProfile & { documents?: BusinessDocument[] }).documents ?? []).map((document) => this.mapDocument(document)),
            currentPolicyAccepted: !!acceptedCurrent,
            acceptedPolicyVersion: acceptedCurrent?.policy_version ?? null,
        };
    }

    async getProfileForUser(userId: string): Promise<IBusinessProfileResponseDto | null> {
        const profile = await this.businessProfileRepository.findOne({
            where: { user_id: userId },
            relations: ["capabilities", "documents"],
            order: {
                capabilities: {
                    created_at: "ASC",
                },
                documents: {
                    created_at: "DESC",
                },
            },
        });

        if (!profile) return null;
        const accepted = await this.loadAcceptedPolicy(profile.id);
        return this.mapProfile(Object.assign(profile, { acceptedPolicies: accepted ? [accepted] : [] }));
    }

    async upsertProfileForUser(userId: string, payload: IBusinessProfileUpsertDto): Promise<IBusinessProfileResponseDto> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) {
            throw new AppError("User not found", 404, ErrorCodes.NOT_FOUND);
        }

        const requestedCapabilities = Array.isArray(payload.requestedCapabilities)
            ? Array.from(new Set(payload.requestedCapabilities))
            : undefined;

        if (requestedCapabilities && requestedCapabilities.some((value) => !Object.values(BusinessCapabilityType).includes(value))) {
            throw new AppError("Invalid business capability selected.", 400, ErrorCodes.VALIDATION_ERROR);
        }

        await this.assertCity(payload.cityId ?? null);

        const phoneNumber = this.validatePhone(payload.phoneNumber);
        const whatsappNumber = this.validatePhone(payload.whatsappNumber);
        const googleMapsUrl = this.validateGoogleMapsUrl(payload.googleMapsUrl);

        return this.businessProfileRepository.manager.transaction(async (manager) => {
            const profileRepo = manager.getRepository(BusinessProfile);
            const capabilityRepo = manager.getRepository(BusinessCapability);

            let profile = await profileRepo.findOne({
                where: { user_id: userId },
                relations: ["capabilities"],
            });

            if (!profile) {
                profile = profileRepo.create({
                    user_id: userId,
                    onboarding_status: BusinessOnboardingStatus.DRAFT,
                });
                profile.capabilities = [];
            }

            profile.owner_legal_name = this.normalizeOptional(payload.ownerLegalName);
            profile.business_name = this.normalizeOptional(payload.businessName);
            profile.phone_number = phoneNumber;
            profile.whatsapp_number = whatsappNumber;
            profile.city_id = payload.cityId ?? null;
            profile.business_address = this.normalizeOptional(payload.businessAddress);
            profile.google_maps_url = googleMapsUrl;

            if (profile.onboarding_status === BusinessOnboardingStatus.SUBMITTED) {
                profile.onboarding_status = BusinessOnboardingStatus.DRAFT;
                profile.submitted_at = null;
            }

            const savedProfile = await profileRepo.save(profile);

            if (requestedCapabilities) {
                const existingCapabilities = profile.capabilities ?? [];
                const existingByType = new Map(existingCapabilities.map((capability) => [capability.type, capability]));

                for (const type of requestedCapabilities) {
                    const current = existingByType.get(type);
                    if (current) {
                        if (current.status === BusinessCapabilityStatus.SUBMITTED) {
                            current.status = BusinessCapabilityStatus.DRAFT;
                        }
                        continue;
                    }
                    const capability = capabilityRepo.create({
                        business_profile_id: savedProfile.id,
                        type,
                        status: BusinessCapabilityStatus.DRAFT,
                    });
                    await capabilityRepo.save(capability);
                }

                const removable = existingCapabilities.filter((capability) => (
                    !requestedCapabilities.includes(capability.type) && EDITABLE_CAPABILITY_STATUSES.has(capability.status)
                ));
                if (removable.length > 0) {
                    await capabilityRepo.remove(removable);
                }
            }

            const reloaded = await profileRepo.findOneOrFail({
                where: { id: savedProfile.id },
                relations: ["capabilities", "documents"],
                order: {
                    capabilities: {
                        created_at: "ASC",
                    },
                    documents: {
                        created_at: "DESC",
                    },
                },
            });

            const accepted = await this.loadAcceptedPolicy(reloaded.id);
            return this.mapProfile(Object.assign(reloaded, { acceptedPolicies: accepted ? [accepted] : [] }));
        });
    }

    private async ensureCurrentPolicyAccepted(
        manager: EntityManager,
        profile: BusinessProfile,
        userId: string,
        ipAddress?: string | null,
        userAgent?: string | null,
    ): Promise<PolicyAcceptance> {
        const current = await this.vendorPolicyService.getCurrentPolicy();
        const acceptanceRepo = manager.getRepository(PolicyAcceptance);
        let acceptedPolicy = await acceptanceRepo.findOne({
            where: {
                business_profile_id: profile.id,
                policy_type: current.policyType,
                policy_version: current.policyVersion,
            },
        });

        if (!acceptedPolicy) {
            acceptedPolicy = acceptanceRepo.create({
                user_id: userId,
                business_profile_id: profile.id,
                policy_type: current.policyType,
                policy_version: current.policyVersion,
                content_hash: current.contentHash,
                accepted_at: new Date(),
                ip_address: ipAddress ?? null,
                user_agent: userAgent ?? null,
            });
            acceptedPolicy = await acceptanceRepo.save(acceptedPolicy);
        }

        return acceptedPolicy;
    }

    async submitForReview(
        userId: string,
        payload?: ISubmitBusinessProfileForReviewDto,
        ipAddress?: string | null,
        userAgent?: string | null,
    ): Promise<IBusinessProfileResponseDto> {
        return this.businessProfileRepository.manager.transaction(async (manager) => {
            const profileRepo = manager.getRepository(BusinessProfile);
            const capabilityRepo = manager.getRepository(BusinessCapability);

            const profile = await profileRepo.findOne({
                where: { user_id: userId },
                relations: ["capabilities"],
            });

            if (!profile) {
                throw new AppError("Complete your business profile before submitting.", 400, ErrorCodes.BAD_REQUEST);
            }

            if (!this.normalizeOptional(profile.owner_legal_name)) {
                throw new AppError("Owner legal name is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!this.normalizeOptional(profile.business_name)) {
                throw new AppError("Business name is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!this.validatePhone(profile.phone_number)) {
                throw new AppError("Phone number is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!profile.city_id) {
                throw new AppError("City is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!this.normalizeOptional(profile.business_address)) {
                throw new AppError("Business address is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!this.validateGoogleMapsUrl(profile.google_maps_url)) {
                throw new AppError("Google Maps link is required.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!profile.capabilities || profile.capabilities.length === 0) {
                throw new AppError("Select at least one business type before submitting.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            const uploadedDocuments = await manager.getRepository(BusinessDocument).find({
                where: { business_profile_id: profile.id },
                order: { created_at: "DESC" },
            });
            const latestByType = new Map<BusinessDocumentType, BusinessDocument>();
            for (const document of uploadedDocuments) {
                if (!latestByType.has(document.document_type)) {
                    latestByType.set(document.document_type, document);
                }
            }
            for (const type of this.requiredDocumentTypes()) {
                const current = latestByType.get(type);
                if (!current || ![BusinessDocumentStatus.UPLOADED, BusinessDocumentStatus.ACCEPTED].includes(current.status)) {
                    throw new AppError(`Required document missing: ${type.replace(/_/g, " ")}.`, 400, ErrorCodes.VALIDATION_ERROR);
                }
            }

            const agreementAccepted = payload?.agreementAccepted === true || payload?.agreement_accepted === true;
            let acceptedPolicy = await this.loadAcceptedPolicy(profile.id);
            if (!agreementAccepted && !acceptedPolicy) {
                throw new AppError("You must accept the current vendor agreement before submitting.", 400, ErrorCodes.VALIDATION_ERROR);
            }
            if (!acceptedPolicy && agreementAccepted) {
                acceptedPolicy = await this.ensureCurrentPolicyAccepted(manager, profile, userId, ipAddress, userAgent);
            }

            const hasApprovedCapability = profile.capabilities.some((capability) => (
                capability.status === BusinessCapabilityStatus.APPROVED
            ));

            profile.submitted_at = new Date();
            profile.review_note = null;
            if (hasApprovedCapability) {
                profile.onboarding_status = BusinessOnboardingStatus.APPROVED;
                profile.reviewed_at = new Date();
                profile.review_note = "Onboarding completed after partner access was auto-approved.";
            } else {
                profile.onboarding_status = BusinessOnboardingStatus.SUBMITTED;
                profile.reviewed_at = null;
            }
            await profileRepo.save(profile);

            for (const capability of profile.capabilities) {
                if (
                    capability.status === BusinessCapabilityStatus.APPROVED
                    || capability.status === BusinessCapabilityStatus.SUSPENDED
                ) {
                    continue;
                }
                capability.status = BusinessCapabilityStatus.SUBMITTED;
                capability.review_note = null;
                await capabilityRepo.save(capability);
            }

            const reloaded = await profileRepo.findOneOrFail({
                where: { id: profile.id },
                relations: ["capabilities", "documents"],
                order: {
                    capabilities: {
                        created_at: "ASC",
                    },
                    documents: {
                        created_at: "DESC",
                    },
                },
            });

            return this.mapProfile(Object.assign(reloaded, { acceptedPolicies: acceptedPolicy ? [acceptedPolicy] : [] }));
        });
    }

    async getCurrentPolicy() {
        return this.vendorPolicyService.getCurrentPolicy();
    }

    async acceptCurrentPolicy(
        userId: string,
        payload: IAcceptCurrentPolicyDto,
        ipAddress?: string | null,
        userAgent?: string | null,
    ): Promise<{ accepted: true; policyVersion: string }> {
        const current = await this.vendorPolicyService.getCurrentPolicy();
        if (
            payload.policyType !== current.policyType
            || payload.policyVersion !== current.policyVersion
            || payload.contentHash !== current.contentHash
        ) {
            throw new AppError("Policy acceptance payload does not match the current vendor agreement.", 400, ErrorCodes.VALIDATION_ERROR);
        }

        const profile = await this.ensureBusinessProfile(userId);
        const existing = await this.policyAcceptanceRepository.findOne({
            where: {
                business_profile_id: profile.id,
                policy_type: current.policyType,
                policy_version: current.policyVersion,
            },
        });
        if (!existing) {
            const acceptance = this.policyAcceptanceRepository.create({
                user_id: userId,
                business_profile_id: profile.id,
                policy_type: current.policyType,
                policy_version: current.policyVersion,
                content_hash: current.contentHash,
                accepted_at: new Date(),
                ip_address: ipAddress ?? null,
                user_agent: userAgent ?? null,
            });
            await this.policyAcceptanceRepository.save(acceptance);
        }
        return { accepted: true, policyVersion: current.policyVersion };
    }

    async createDocumentPresign(
        userId: string,
        payload: IBusinessDocumentPresignRequestDto,
    ): Promise<IBusinessDocumentPresignResponseDto> {
        if (!Object.values(BusinessDocumentType).includes(payload.documentType)) {
            throw new AppError("Invalid business document type.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        if (!payload.fileName || !payload.mimeType || !payload.sizeBytes) {
            throw new AppError("fileName, mimeType, and sizeBytes are required.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        let uploadPolicy: { mimeType: string; extension: string };
        try {
            uploadPolicy = validateDocumentUpload(
                payload.fileName,
                payload.mimeType,
                payload.sizeBytes,
                this.r2ClientService.getMaxFileSize(),
            );
        } catch (error) {
            throw new AppError((error as Error).message, 400, ErrorCodes.VALIDATION_ERROR);
        }

        const profile = await this.ensureBusinessProfile(userId);
        const folder = `partner/businesses/${profile.id}/documents/${payload.documentType}`;
        const presigned = await this.r2ClientService.generatePresignedUrl(
            payload.fileName,
            uploadPolicy.mimeType,
            folder,
            uploadPolicy.extension,
            payload.sizeBytes,
        );

        const existingSameType = await this.businessDocumentRepository.find({
            where: {
                business_profile_id: profile.id,
                document_type: payload.documentType,
            },
        });
        for (const previous of existingSameType) {
            if ([BusinessDocumentStatus.PENDING_UPLOAD, BusinessDocumentStatus.UPLOADED, BusinessDocumentStatus.REJECTED].includes(previous.status)) {
                previous.status = BusinessDocumentStatus.SUPERSEDED;
                await this.businessDocumentRepository.save(previous);
            }
        }

        const document = await this.businessDocumentRepository.save(this.businessDocumentRepository.create({
            business_profile_id: profile.id,
            document_type: payload.documentType,
            original_file_name: payload.fileName,
            storage_key: presigned.key,
            public_url: presigned.publicUrl,
            mime_type: uploadPolicy.mimeType,
            size_bytes: String(payload.sizeBytes),
            status: BusinessDocumentStatus.PENDING_UPLOAD,
        }));

        return {
            ...this.mapDocument(document),
            uploadUrl: presigned.uploadUrl,
            maxFileSize: this.r2ClientService.getMaxFileSize(),
        };
    }

    async completeDocumentUpload(
        userId: string,
        payload: ICompleteBusinessDocumentUploadDto,
    ): Promise<IBusinessDocumentDto> {
        const profile = await this.ensureBusinessProfile(userId);
        const document = await this.businessDocumentRepository.findOne({
            where: {
                id: payload.documentId,
                business_profile_id: profile.id,
            },
        });
        if (!document) {
            throw new AppError("Business document not found.", 404, ErrorCodes.NOT_FOUND);
        }
        if (document.storage_key !== payload.key || document.public_url !== payload.publicUrl) {
            throw new AppError("Upload completion payload does not match the generated document target.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        try {
            await this.r2ClientService.verifyUploadedObject(
                document.storage_key,
                document.mime_type,
                Number(document.size_bytes),
            );
        } catch {
            throw new AppError("Uploaded document could not be verified.", 400, ErrorCodes.VALIDATION_ERROR);
        }
        document.status = BusinessDocumentStatus.UPLOADED;
        document.uploaded_at = new Date();
        await this.businessDocumentRepository.save(document);
        return this.mapDocument(document);
    }
}
