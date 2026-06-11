import { AppDataSource } from "@config/ormconfig";
import { AppError } from "@common/errors/AppError";
import { ErrorCodes } from "@common/errors/error-codes";
import {
    BusinessCapabilityStatus,
    BusinessCapabilityType,
    BusinessOnboardingStatus,
} from "@common/enums/business.enums";
import { UserRole } from "@common/enums/user.enums";
import { ListingStatus, ListingType } from "@common/enums/listing.enums";
import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import { BusinessProfile } from "@modules/user/entity/user/business-profile.entity";
import { BusinessCapability } from "@modules/user/entity/user/business-capability.entity";
import { BusinessDocument } from "@modules/user/entity/user/business-document.entity";
import { PolicyAcceptance } from "@modules/user/entity/user/policy-acceptance.entity";
import { Listing } from "@modules/user/entity/listing";
import {
    IAdminBusinessSummaryDto,
    IReviewBusinessCapabilityDto,
    IReviewBusinessProfileDto,
} from "@modules/user/types/admin-business-review.types";
import { VendorPolicyService } from "./vendor-policy.service";
import { logInfo } from "@lib/logger";
import { NotificationOutboxService } from "./notification-outbox.service";
import { SendEmail } from "./email/sendEmail";
import { CONFIG } from "@config/config";

type ReviewContext = {
    user: User;
    profile: UserProfile;
    businessProfile: BusinessProfile;
    capabilities: BusinessCapability[];
    isLegacy: boolean;
};

const listingTypeToCapability: Partial<Record<ListingType, BusinessCapabilityType>> = {
    [ListingType.HOTEL]: BusinessCapabilityType.HOTEL,
    [ListingType.RESTAURANT]: BusinessCapabilityType.RESTAURANT,
    [ListingType.TOUR]: BusinessCapabilityType.TOUR,
    [ListingType.VEHICLE]: BusinessCapabilityType.VEHICLE,
};

const capabilityToListingType: Record<BusinessCapabilityType, ListingType> = {
    [BusinessCapabilityType.HOTEL]: ListingType.HOTEL,
    [BusinessCapabilityType.RESTAURANT]: ListingType.RESTAURANT,
    [BusinessCapabilityType.TOUR]: ListingType.TOUR,
    [BusinessCapabilityType.VEHICLE]: ListingType.VEHICLE,
};

export class AdminBusinessReviewService {
    private readonly userRepository = AppDataSource.getRepository(User);
    private readonly profileRepository = AppDataSource.getRepository(UserProfile);
    private readonly businessProfileRepository = AppDataSource.getRepository(BusinessProfile);
    private readonly capabilityRepository = AppDataSource.getRepository(BusinessCapability);
    private readonly businessDocumentRepository = AppDataSource.getRepository(BusinessDocument);
    private readonly policyAcceptanceRepository = AppDataSource.getRepository(PolicyAcceptance);
    private readonly listingRepository = AppDataSource.getRepository(Listing);
    private readonly vendorPolicyService = new VendorPolicyService();
    private readonly notificationOutboxService = new NotificationOutboxService();
    private readonly sendEmailService = new SendEmail();

    private baseStatusFromUser(user: User): BusinessOnboardingStatus {
        if (user.isActive) return BusinessOnboardingStatus.APPROVED;
        if (user.isVerified) return BusinessOnboardingStatus.SUBMITTED;
        return BusinessOnboardingStatus.DRAFT;
    }

    private capabilityStatusFromUser(user: User): BusinessCapabilityStatus {
        if (user.isActive) return BusinessCapabilityStatus.APPROVED;
        if (user.isVerified) return BusinessCapabilityStatus.SUBMITTED;
        return BusinessCapabilityStatus.DRAFT;
    }

    private async ensureUserProfile(user: User): Promise<UserProfile> {
        if (user.profile) return user.profile;
        const created = this.profileRepository.create({
            user_id: user.id,
            username: user.email.split("@")[0] || "Vendor",
        });
        const saved = await this.profileRepository.save(created);
        user.profile = saved;
        return saved;
    }

    private async inferCapabilities(userId: string, fallbackStatus: BusinessCapabilityStatus): Promise<BusinessCapabilityType[]> {
        const listings = await this.listingRepository.find({
            where: { vendor_id: userId },
            select: { type: true },
        });
        const inferred = new Set<BusinessCapabilityType>();
        for (const listing of listings) {
            const type = listingTypeToCapability[listing.type];
            if (type) inferred.add(type);
        }
        if (inferred.size === 0 && fallbackStatus !== BusinessCapabilityStatus.DRAFT) {
            inferred.add(BusinessCapabilityType.HOTEL);
        }
        return Array.from(inferred);
    }

    private async ensureBusinessProfileForUser(user: User): Promise<BusinessProfile> {
        let businessProfile = await this.businessProfileRepository.findOne({
            where: { user_id: user.id },
        });

        if (businessProfile) {
            return businessProfile;
        }

        const profile = await this.ensureUserProfile(user);
        businessProfile = this.businessProfileRepository.create({
            user_id: user.id,
            owner_legal_name: profile.username,
            business_name: profile.business_name || profile.username,
            phone_number: profile.phone_number || null,
            onboarding_status: this.baseStatusFromUser(user),
            submitted_at: user.isVerified ? user.createdAt : null,
        });
        return this.businessProfileRepository.save(businessProfile);
    }

    private async ensureCapabilitiesForProfile(
        profile: BusinessProfile,
        user: User,
    ): Promise<BusinessCapability[]> {
        const existing = await this.capabilityRepository.find({
            where: { business_profile_id: profile.id },
            order: { created_at: "ASC" },
        });
        if (existing.length > 0) {
            return existing;
        }

        const status = this.capabilityStatusFromUser(user);
        const inferred = await this.inferCapabilities(user.id, status);
        const created: BusinessCapability[] = [];
        for (const type of inferred) {
            created.push(await this.capabilityRepository.save(this.capabilityRepository.create({
                business_profile_id: profile.id,
                type,
                status,
                approved_at: status === BusinessCapabilityStatus.APPROVED ? new Date() : null,
            })));
        }
        return created;
    }

    private mapSummary(
        user: User,
        profile: UserProfile,
        businessProfile: BusinessProfile | null,
        capabilities: BusinessCapability[],
        isLegacy: boolean,
    ): IAdminBusinessSummaryDto {
        return {
            id: businessProfile?.id || user.id,
            businessProfileId: businessProfile?.id || null,
            userId: user.id,
            email: user.email,
            username: profile.username || user.email.split("@")[0] || "Vendor",
            ownerLegalName: businessProfile?.owner_legal_name ?? profile.username ?? null,
            businessName: businessProfile?.business_name ?? profile.business_name ?? profile.username ?? null,
            phoneNumber: businessProfile?.phone_number ?? profile.phone_number ?? null,
            cityId: businessProfile?.city_id ?? null,
            businessAddress: businessProfile?.business_address ?? null,
            googleMapsUrl: businessProfile?.google_maps_url ?? null,
            isLegacy,
            isActive: user.isActive,
            isVerified: user.isVerified,
            onboardingStatus: businessProfile?.onboarding_status ?? this.baseStatusFromUser(user),
            reviewNote: businessProfile?.review_note ?? null,
            createdAt: user.createdAt.toISOString(),
            capabilities: capabilities.map((capability) => ({
                id: capability.id,
                type: capability.type,
                status: capability.status,
                reviewNote: capability.review_note ?? null,
                approvedAt: capability.approved_at?.toISOString() ?? null,
            })),
            documents: ((businessProfile as BusinessProfile & { documents?: BusinessDocument[] } | null)?.documents ?? []).map((document) => ({
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
            })),
            currentPolicyAccepted: (businessProfile as BusinessProfile & { acceptedPolicies?: PolicyAcceptance[] } | null)?.acceptedPolicies?.length
                ? true
                : false,
            acceptedPolicyVersion: (businessProfile as BusinessProfile & { acceptedPolicies?: PolicyAcceptance[] } | null)?.acceptedPolicies?.[0]?.policy_version ?? null,
        };
    }

    private async resolveContext(idOrUserId: string): Promise<ReviewContext> {
        const currentPolicy = await this.vendorPolicyService.getCurrentPolicy();
        let businessProfile = await this.businessProfileRepository.findOne({
            where: [{ id: idOrUserId }, { user_id: idOrUserId }],
            relations: ["user", "user.profile", "capabilities", "documents"],
            order: { capabilities: { created_at: "ASC" }, documents: { created_at: "DESC" } },
        });

        if (businessProfile) {
            const user = businessProfile.user;
            const profile = await this.ensureUserProfile(user);
            let capabilities = businessProfile.capabilities ?? [];
            if (capabilities.length === 0) {
                capabilities = await this.ensureCapabilitiesForProfile(businessProfile, user);
                businessProfile = await this.businessProfileRepository.findOneOrFail({
                    where: { id: businessProfile.id },
                    relations: ["user", "user.profile", "capabilities", "documents"],
                    order: { capabilities: { created_at: "ASC" }, documents: { created_at: "DESC" } },
                });
            }
            const acceptedPolicies = await this.policyAcceptanceRepository.find({
                where: { business_profile_id: businessProfile.id, policy_type: currentPolicy.policyType },
                order: { accepted_at: "DESC" },
                take: 1,
            });
            return {
                user: businessProfile.user,
                profile: profile,
                businessProfile: Object.assign(businessProfile, { acceptedPolicies }),
                capabilities: businessProfile.capabilities ?? capabilities,
                isLegacy: false,
            };
        }

        const user = await this.userRepository.findOne({
            where: { id: idOrUserId, userType: UserRole.VENDOR },
            relations: ["profile"],
        });
        if (!user) {
            throw new AppError("Business application not found", 404, ErrorCodes.NOT_FOUND);
        }

        const profile = await this.ensureUserProfile(user);
        businessProfile = await this.ensureBusinessProfileForUser(user);
        const capabilities = await this.ensureCapabilitiesForProfile(businessProfile, user);
        const documents = await this.businessDocumentRepository.find({
            where: { business_profile_id: businessProfile.id },
            order: { created_at: "DESC" },
        });
        const acceptedPolicies = await this.policyAcceptanceRepository.find({
            where: { business_profile_id: businessProfile.id, policy_type: currentPolicy.policyType },
            order: { accepted_at: "DESC" },
            take: 1,
        });

        return {
            user,
            profile,
            businessProfile: Object.assign(businessProfile, { documents, acceptedPolicies }),
            capabilities,
            isLegacy: true,
        };
    }

    private async syncCapabilityListings(
        userId: string,
        capabilityType: BusinessCapabilityType,
        active: boolean,
    ): Promise<void> {
        const listingType = capabilityToListingType[capabilityType];
        await this.listingRepository.update(
            { vendor_id: userId, type: listingType },
            {
                is_active: active,
                status: active ? ListingStatus.ACTIVE : ListingStatus.INACTIVE,
            },
        );
    }

    private async reconcileUserState(
        context: ReviewContext,
        adminUserId?: string,
        note?: string | null,
    ): Promise<void> {
        const approvedCount = context.capabilities.filter((capability) => capability.status === BusinessCapabilityStatus.APPROVED).length;

        context.user.isActive = approvedCount > 0;
        context.profile.is_business_verified = approvedCount > 0;
        if (!context.profile.business_name) {
            context.profile.business_name = context.businessProfile.business_name || context.profile.username;
        }
        if (context.user.userType !== UserRole.VENDOR && approvedCount > 0) {
            context.user.userType = UserRole.VENDOR;
        }

        if (approvedCount > 0) {
            context.businessProfile.onboarding_status = BusinessOnboardingStatus.APPROVED;
        } else if (context.businessProfile.onboarding_status === BusinessOnboardingStatus.APPROVED) {
            context.businessProfile.onboarding_status = BusinessOnboardingStatus.SUBMITTED;
        }

        if (adminUserId) {
            context.businessProfile.reviewed_by = adminUserId;
            context.businessProfile.reviewed_at = new Date();
        }
        if (note !== undefined) {
            context.businessProfile.review_note = note;
        }

        await this.userRepository.save(context.user);
        await this.profileRepository.save(context.profile);
        await this.businessProfileRepository.save(context.businessProfile);
    }

    private async sendApprovalNotifications(context: ReviewContext): Promise<void> {
        const approvedCapabilities = context.capabilities
            .filter((capability) => capability.status === BusinessCapabilityStatus.APPROVED)
            .map((capability) => capability.type);
        const ownerName = context.businessProfile.owner_legal_name
            ?? context.profile.username
            ?? "Partner";
        const businessName = context.businessProfile.business_name
            ?? context.profile.business_name
            ?? "Your business";
        const phoneNumber = context.businessProfile.whatsapp_number
            ?? context.businessProfile.phone_number
            ?? context.profile.phone_number
            ?? null;
        const partnerPortalUrl = CONFIG.partner_domain.url || "https://partner.gokhor.com";

        await AppDataSource.transaction(async (manager) => {
            await this.notificationOutboxService.enqueuePartnerApproval({
                manager,
                userId: context.user.id,
                phoneNumber,
                ownerName,
                businessName,
                approvedCapabilities,
                partnerPortalUrl,
            });
        });

        if (context.user.email) {
            await this.sendEmailService.sendPartnerApprovalEmail({
                to: context.user.email,
                recipientName: ownerName,
                businessName,
                approvedCapabilities,
                partnerPortalUrl,
                metadata: {
                    userId: context.user.id,
                    businessProfileId: context.businessProfile.id,
                    approvedCapabilities,
                },
            });
        }
    }

    async listBusinesses(): Promise<IAdminBusinessSummaryDto[]> {
        const currentPolicy = await this.vendorPolicyService.getCurrentPolicy();
        const vendorUsers = await this.userRepository.find({
            where: { userType: UserRole.VENDOR },
            relations: ["profile"],
            order: { createdAt: "DESC" },
        });

        const businessProfiles = await this.businessProfileRepository.find({
            relations: ["user", "user.profile", "capabilities", "documents"],
            order: {
                created_at: "DESC",
                capabilities: { created_at: "ASC" },
                documents: { created_at: "DESC" },
            },
        });

        const profileByUserId = new Map(businessProfiles.map((profile) => [profile.user_id, profile]));
        const summaries: IAdminBusinessSummaryDto[] = [];

        for (const user of vendorUsers) {
            const profile = await this.ensureUserProfile(user);
            const businessProfile = profileByUserId.get(user.id) ?? null;
            const capabilities = businessProfile?.capabilities?.length
                ? businessProfile.capabilities
                : await this.ensureCapabilitiesForProfile(
                    businessProfile ?? await this.ensureBusinessProfileForUser(user),
                    user,
                );
            const ensuredBusinessProfile = businessProfile ?? await this.businessProfileRepository.findOneOrFail({
                where: { user_id: user.id },
                relations: ["documents"],
            });
            const acceptedPolicies = await this.policyAcceptanceRepository.find({
                where: { business_profile_id: ensuredBusinessProfile.id, policy_type: currentPolicy.policyType },
                order: { accepted_at: "DESC" },
                take: 1,
            });
            summaries.push(this.mapSummary(user, profile, Object.assign(ensuredBusinessProfile, { acceptedPolicies }), capabilities, !profileByUserId.has(user.id)));
        }

        return summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    async getBusiness(idOrUserId: string): Promise<IAdminBusinessSummaryDto> {
        const context = await this.resolveContext(idOrUserId);
        return this.mapSummary(context.user, context.profile, context.businessProfile, context.capabilities, context.isLegacy);
    }

    async reviewCapability(
        idOrUserId: string,
        capabilityType: BusinessCapabilityType,
        payload: IReviewBusinessCapabilityDto,
        adminUserId?: string,
    ): Promise<IAdminBusinessSummaryDto> {
        const context = await this.resolveContext(idOrUserId);
        const hadApprovedAccess = context.user.isActive || context.capabilities.some((item) => item.status === BusinessCapabilityStatus.APPROVED);
        let capability = context.capabilities.find((item) => item.type === capabilityType);
        if (!capability) {
            capability = await this.capabilityRepository.save(this.capabilityRepository.create({
                business_profile_id: context.businessProfile.id,
                type: capabilityType,
                status: BusinessCapabilityStatus.DRAFT,
            }));
            context.capabilities.push(capability);
        }

        if (payload.action === "approve") {
            capability.status = BusinessCapabilityStatus.APPROVED;
            capability.approved_at = new Date();
            capability.approved_by = adminUserId ?? null;
            capability.review_note = payload.note?.trim() || null;
            context.businessProfile.onboarding_status = BusinessOnboardingStatus.APPROVED;
            await this.syncCapabilityListings(context.user.id, capabilityType, true);
        } else if (payload.action === "reject") {
            capability.status = BusinessCapabilityStatus.REJECTED;
            capability.review_note = payload.note?.trim() || null;
            capability.approved_at = null;
            capability.approved_by = null;
            if (!context.capabilities.some((item) => item.id !== capability!.id && item.status === BusinessCapabilityStatus.APPROVED)) {
                context.businessProfile.onboarding_status = BusinessOnboardingStatus.REJECTED;
            }
            await this.syncCapabilityListings(context.user.id, capabilityType, false);
        } else {
            capability.status = BusinessCapabilityStatus.SUSPENDED;
            capability.review_note = payload.note?.trim() || null;
            capability.approved_at = null;
            capability.approved_by = null;
            await this.syncCapabilityListings(context.user.id, capabilityType, false);
            if (!context.capabilities.some((item) => item.id !== capability!.id && item.status === BusinessCapabilityStatus.APPROVED)) {
                context.businessProfile.onboarding_status = BusinessOnboardingStatus.SUSPENDED;
            }
        }

        await this.capabilityRepository.save(capability);
        await this.reconcileUserState(context, adminUserId, payload.note?.trim() || null);
        const hasApprovedAccess = context.user.isActive || context.capabilities.some((item) => item.status === BusinessCapabilityStatus.APPROVED);
        if (!hadApprovedAccess && hasApprovedAccess) {
            await this.sendApprovalNotifications(context);
        }

        logInfo("Business capability reviewed", {
            businessProfileId: context.businessProfile.id,
            userId: context.user.id,
            capabilityType,
            action: payload.action,
            adminUserId,
        });

        return this.getBusiness(context.businessProfile.id);
    }

    async reviewProfile(
        idOrUserId: string,
        payload: IReviewBusinessProfileDto,
        adminUserId?: string,
    ): Promise<IAdminBusinessSummaryDto> {
        const context = await this.resolveContext(idOrUserId);
        context.businessProfile.onboarding_status = payload.status;
        context.businessProfile.review_note = payload.note?.trim() || null;
        context.businessProfile.reviewed_by = adminUserId ?? null;
        context.businessProfile.reviewed_at = new Date();

        if (payload.status === BusinessOnboardingStatus.SUSPENDED) {
            for (const capability of context.capabilities) {
                capability.status = BusinessCapabilityStatus.SUSPENDED;
                capability.review_note = payload.note?.trim() || null;
                capability.approved_at = null;
                capability.approved_by = null;
                await this.capabilityRepository.save(capability);
                await this.syncCapabilityListings(context.user.id, capability.type, false);
            }
            context.user.isActive = false;
            context.profile.is_business_verified = false;
        } else if (
            payload.status === BusinessOnboardingStatus.CHANGES_REQUESTED
            || payload.status === BusinessOnboardingStatus.REJECTED
        ) {
            if (!context.capabilities.some((capability) => capability.status === BusinessCapabilityStatus.APPROVED)) {
                context.user.isActive = false;
                context.profile.is_business_verified = false;
            }
        }

        await this.userRepository.save(context.user);
        await this.profileRepository.save(context.profile);
        await this.businessProfileRepository.save(context.businessProfile);

        logInfo("Business profile reviewed", {
            businessProfileId: context.businessProfile.id,
            userId: context.user.id,
            status: payload.status,
            adminUserId,
        });

        return this.getBusiness(context.businessProfile.id);
    }
}
