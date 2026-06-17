import "reflect-metadata";
import "dotenv/config";
import { AppDataSource } from "@config/ormconfig";
import { User } from "@modules/user/entity/user/user.entity";
import { UserProfile } from "@modules/user/entity/user/user-profile.entity";
import { Listing } from "@modules/user/entity/listing";
import { BusinessProfile } from "@modules/user/entity/user/business-profile.entity";
import { BusinessCapability } from "@modules/user/entity/user/business-capability.entity";
import { UserRole } from "@common/enums/user.enums";
import { ListingStatus, ListingType } from "@common/enums/listing.enums";
import {
    BusinessCapabilityStatus,
    BusinessCapabilityType,
    BusinessOnboardingStatus,
} from "@common/enums/business.enums";

type Args = {
    apply: boolean;
    verbose: boolean;
    help: boolean;
};

type VendorListingSummary = {
    vendorId: string;
    type: ListingType;
    total: number;
    active: number;
    pending: number;
    inactive: number;
};

type Counters = {
    vendorsScanned: number;
    profilesCreated: number;
    profilesUpdated: number;
    capabilitiesCreated: number;
    capabilitiesUpdated: number;
    vendorsWithoutListings: number;
    activeVendorsWithoutListings: number;
    listingsMissingOwners: number;
    listingsChecked: number;
};

const listingTypeToCapabilityType: Partial<Record<ListingType, BusinessCapabilityType>> = {
    [ListingType.HOTEL]: BusinessCapabilityType.HOTEL,
    [ListingType.RESTAURANT]: BusinessCapabilityType.RESTAURANT,
    [ListingType.TOUR]: BusinessCapabilityType.TOUR,
    [ListingType.VEHICLE]: BusinessCapabilityType.VEHICLE,
};

function parseArgs(argv: string[]): Args {
    return {
        apply: argv.includes("--apply"),
        verbose: argv.includes("--verbose") || argv.includes("-v"),
        help: argv.includes("--help") || argv.includes("-h"),
    };
}

function printHelp(): void {
    console.log("Business onboarding backfill");
    console.log("");
    console.log("Usage:");
    console.log("  npm run backfill:business-onboarding");
    console.log("  npm run backfill:business-onboarding -- --apply");
    console.log("  npm run backfill:business-onboarding -- --verbose");
    console.log("");
    console.log("Modes:");
    console.log("  default     Report only. Scans vendors/listings and reports what would change.");
    console.log("  --apply     Writes missing business profiles and capabilities.");
    console.log("  --verbose   Prints vendor-level detail during the scan.");
}

function onboardingStatusForUser(user: User): BusinessOnboardingStatus {
    if (user.isActive) return BusinessOnboardingStatus.APPROVED;
    if (user.isVerified) return BusinessOnboardingStatus.SUBMITTED;
    return BusinessOnboardingStatus.DRAFT;
}

function capabilityStatusForUserAndListings(
    user: User,
    summary?: VendorListingSummary,
): BusinessCapabilityStatus {
    if (summary?.active && summary.active > 0) return BusinessCapabilityStatus.APPROVED;
    if (user.isActive) return BusinessCapabilityStatus.APPROVED;
    if ((summary?.pending ?? 0) > 0 || (summary?.inactive ?? 0) > 0 || user.isVerified) {
        return BusinessCapabilityStatus.SUBMITTED;
    }
    return BusinessCapabilityStatus.DRAFT;
}

function summarizeListings(listings: Listing[]): VendorListingSummary[] {
    const grouped = new Map<string, VendorListingSummary>();
    for (const listing of listings) {
        if (!listing.vendor_id) continue;
        const key = `${listing.vendor_id}:${listing.type}`;
        const current = grouped.get(key) ?? {
            vendorId: listing.vendor_id,
            type: listing.type,
            total: 0,
            active: 0,
            pending: 0,
            inactive: 0,
        };
        current.total += 1;
        if (listing.is_active || listing.status === ListingStatus.ACTIVE) current.active += 1;
        else if (listing.status === ListingStatus.PENDING || listing.status === ListingStatus.DRAFT) current.pending += 1;
        else current.inactive += 1;
        grouped.set(key, current);
    }
    return Array.from(grouped.values());
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const counters: Counters = {
        vendorsScanned: 0,
        profilesCreated: 0,
        profilesUpdated: 0,
        capabilitiesCreated: 0,
        capabilitiesUpdated: 0,
        vendorsWithoutListings: 0,
        activeVendorsWithoutListings: 0,
        listingsMissingOwners: 0,
        listingsChecked: 0,
    };

    console.log("Business onboarding backfill");
    console.log("===========================");
    console.log(`Mode: ${args.apply ? "APPLY" : "REPORT ONLY"}`);

    await AppDataSource.initialize();

    try {
        const userRepo = AppDataSource.getRepository(User);
        const profileRepo = AppDataSource.getRepository(UserProfile);
        const listingRepo = AppDataSource.getRepository(Listing);
        const businessProfileRepo = AppDataSource.getRepository(BusinessProfile);
        const capabilityRepo = AppDataSource.getRepository(BusinessCapability);

        const [vendors, listings, businessProfiles, capabilities] = await Promise.all([
            userRepo.find({
                where: { userType: UserRole.VENDOR },
                relations: ["profile"],
                order: { createdAt: "ASC" },
            }),
            listingRepo.find({
                select: {
                    id: true,
                    vendor_id: true,
                    type: true,
                    status: true,
                    is_active: true,
                },
            }),
            businessProfileRepo.find({
                relations: ["capabilities"],
            }),
            capabilityRepo.find(),
        ]);

        const profileByUserId = new Map(businessProfiles.map((profile) => [profile.user_id, profile]));
        const capabilitiesByProfileId = new Map<string, BusinessCapability[]>();
        for (const capability of capabilities) {
            const list = capabilitiesByProfileId.get(capability.business_profile_id) ?? [];
            list.push(capability);
            capabilitiesByProfileId.set(capability.business_profile_id, list);
        }

        const listingsByVendorId = new Map<string, Listing[]>();
        for (const listing of listings) {
            counters.listingsChecked += 1;
            if (!listing.vendor_id) {
                counters.listingsMissingOwners += 1;
                continue;
            }
            const list = listingsByVendorId.get(listing.vendor_id) ?? [];
            list.push(listing);
            listingsByVendorId.set(listing.vendor_id, list);
        }

        const listingSummaries = summarizeListings(listings);
        const listingSummaryByVendorAndType = new Map(
            listingSummaries.map((summary) => [`${summary.vendorId}:${summary.type}`, summary]),
        );

        const runner = AppDataSource.createQueryRunner();
        if (args.apply) {
            await runner.connect();
            await runner.startTransaction();
        }

        try {
            for (const vendor of vendors) {
                counters.vendorsScanned += 1;

                const userProfile = vendor.profile ?? profileRepo.create({
                    user_id: vendor.id,
                    username: vendor.email.split("@")[0] || "Vendor",
                });

                const existingBusinessProfile = profileByUserId.get(vendor.id);
                const nextOnboardingStatus = onboardingStatusForUser(vendor);

                let businessProfile = existingBusinessProfile;
                let profileChanged = false;

                if (!businessProfile) {
                    businessProfile = businessProfileRepo.create({
                        user_id: vendor.id,
                        owner_legal_name: userProfile.username,
                        business_name: userProfile.business_name || userProfile.username,
                        phone_number: userProfile.phone_number || null,
                        whatsapp_number: userProfile.phone_number || null,
                        onboarding_status: nextOnboardingStatus,
                        submitted_at: vendor.isVerified ? vendor.createdAt : null,
                        reviewed_at: vendor.isActive ? vendor.updatedAt : null,
                    });
                    counters.profilesCreated += 1;
                    profileChanged = true;
                } else {
                    const candidateBusinessName = businessProfile.business_name || userProfile.business_name || userProfile.username;
                    const candidateOwnerName = businessProfile.owner_legal_name || userProfile.username;
                    const candidatePhone = businessProfile.phone_number || userProfile.phone_number || null;
                    const candidateWhatsapp = businessProfile.whatsapp_number || candidatePhone;
                    if (businessProfile.business_name !== candidateBusinessName) {
                        businessProfile.business_name = candidateBusinessName;
                        profileChanged = true;
                    }
                    if (businessProfile.owner_legal_name !== candidateOwnerName) {
                        businessProfile.owner_legal_name = candidateOwnerName;
                        profileChanged = true;
                    }
                    if (businessProfile.phone_number !== candidatePhone) {
                        businessProfile.phone_number = candidatePhone;
                        profileChanged = true;
                    }
                    if (businessProfile.whatsapp_number !== candidateWhatsapp) {
                        businessProfile.whatsapp_number = candidateWhatsapp;
                        profileChanged = true;
                    }
                    if (businessProfile.onboarding_status !== nextOnboardingStatus) {
                        businessProfile.onboarding_status = nextOnboardingStatus;
                        profileChanged = true;
                    }
                    if (!businessProfile.submitted_at && vendor.isVerified) {
                        businessProfile.submitted_at = vendor.createdAt;
                        profileChanged = true;
                    }
                    if (!businessProfile.reviewed_at && vendor.isActive) {
                        businessProfile.reviewed_at = vendor.updatedAt;
                        profileChanged = true;
                    }
                    if (profileChanged) {
                        counters.profilesUpdated += 1;
                    }
                }

                const vendorListings = listingsByVendorId.get(vendor.id) ?? [];
                if (vendorListings.length === 0) {
                    counters.vendorsWithoutListings += 1;
                    if (vendor.isActive) counters.activeVendorsWithoutListings += 1;
                }

                const capabilityTypes = new Set<BusinessCapabilityType>();
                for (const listing of vendorListings) {
                    const mapped = listingTypeToCapabilityType[listing.type];
                    if (mapped) capabilityTypes.add(mapped);
                }
                if (capabilityTypes.size === 0) {
                    capabilityTypes.add(BusinessCapabilityType.HOTEL);
                }

                if (args.verbose) {
                    console.log(
                        `- ${vendor.email}: profile=${existingBusinessProfile ? "existing" : "new"} capabilities=${Array.from(capabilityTypes).join(",")}`,
                    );
                }

                if (args.apply && profileChanged && businessProfile) {
                    businessProfile = await runner.manager.save(BusinessProfile, businessProfile);
                    profileByUserId.set(vendor.id, businessProfile);
                } else if (args.apply && !existingBusinessProfile && businessProfile) {
                    businessProfile = await runner.manager.save(BusinessProfile, businessProfile);
                    profileByUserId.set(vendor.id, businessProfile);
                }

                const effectiveBusinessProfile = businessProfile!;
                const existingCapabilities = capabilitiesByProfileId.get(effectiveBusinessProfile.id) ?? [];
                const existingCapabilityByType = new Map(existingCapabilities.map((capability) => [capability.type, capability]));

                for (const capabilityType of capabilityTypes) {
                    const summary = listingSummaryByVendorAndType.get(`${vendor.id}:${capabilityType}`);
                    const nextStatus = capabilityStatusForUserAndListings(vendor, summary);
                    const existingCapability = existingCapabilityByType.get(capabilityType);

                    if (!existingCapability) {
                        counters.capabilitiesCreated += 1;
                        if (args.apply) {
                            const created = await runner.manager.save(BusinessCapability, capabilityRepo.create({
                                business_profile_id: effectiveBusinessProfile.id,
                                type: capabilityType,
                                status: nextStatus,
                                approved_at: nextStatus === BusinessCapabilityStatus.APPROVED ? vendor.updatedAt : null,
                            }));
                            const list = capabilitiesByProfileId.get(effectiveBusinessProfile.id) ?? [];
                            list.push(created);
                            capabilitiesByProfileId.set(effectiveBusinessProfile.id, list);
                        }
                        continue;
                    }

                    let capabilityChanged = false;
                    if (existingCapability.status !== nextStatus) {
                        existingCapability.status = nextStatus;
                        capabilityChanged = true;
                    }
                    if (nextStatus === BusinessCapabilityStatus.APPROVED && !existingCapability.approved_at) {
                        existingCapability.approved_at = vendor.updatedAt;
                        capabilityChanged = true;
                    }
                    if (capabilityChanged) {
                        counters.capabilitiesUpdated += 1;
                        if (args.apply) {
                            await runner.manager.save(BusinessCapability, existingCapability);
                        }
                    }
                }
            }

            if (args.apply) {
                await runner.commitTransaction();
            }
        } catch (error) {
            if (args.apply) {
                await runner.rollbackTransaction();
            }
            throw error;
        } finally {
            if (args.apply) {
                await runner.release();
            }
        }

        console.log("\nSummary");
        console.log("-------");
        console.log(`vendors scanned:            ${counters.vendorsScanned}`);
        console.log(`profiles created:           ${counters.profilesCreated}`);
        console.log(`profiles updated:           ${counters.profilesUpdated}`);
        console.log(`capabilities created:       ${counters.capabilitiesCreated}`);
        console.log(`capabilities updated:       ${counters.capabilitiesUpdated}`);
        console.log(`vendors without listings:   ${counters.vendorsWithoutListings}`);
        console.log(`active vendors no listings: ${counters.activeVendorsWithoutListings}`);
        console.log(`listings checked:           ${counters.listingsChecked}`);
        console.log(`listings missing owners:    ${counters.listingsMissingOwners}`);
        console.log(`\nResult: ${args.apply ? "changes committed" : "report only, no writes made"}`);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
    }
}

main().catch((error) => {
    console.error("\nBackfill failed:", error);
    process.exit(1);
});
