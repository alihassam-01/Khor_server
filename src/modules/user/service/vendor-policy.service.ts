import * as crypto from "crypto";
import { CURRENT_VENDOR_POLICY } from "./vendor-policy.content";
import { AppDataSource } from "@config/ormconfig";
import { PlatformSetting } from "@modules/user/entity/payment/platform-setting.entity";
import { ICurrentVendorPolicyDto, IUpdateVendorPolicyDto } from "@modules/user/types/vendor-policy.types";
import { User } from "@modules/user/entity/user/user.entity";
import { UserRole } from "@common/enums/user.enums";
import { SendEmail } from "./email/sendEmail";
import { CONFIG } from "@config/config";

type StoredVendorPolicy = {
    policyVersion: string;
    title: string;
    content: string;
};

export class VendorPolicyService {
    private readonly platformSettingRepository = AppDataSource.getRepository(PlatformSetting);
    private readonly userRepository = AppDataSource.getRepository(User);
    private readonly settingKey = "vendor_policy_current";
    private readonly sendEmailService = new SendEmail();

    private buildPolicy(payload: StoredVendorPolicy): ICurrentVendorPolicyDto {
        return {
            policyType: CURRENT_VENDOR_POLICY.policyType,
            policyVersion: payload.policyVersion,
            title: payload.title,
            content: payload.content,
            contentHash: crypto.createHash("sha256").update(payload.content).digest("hex"),
        };
    }

    private getFallbackPolicy(): ICurrentVendorPolicyDto {
        return this.buildPolicy({
            title: CURRENT_VENDOR_POLICY.title,
            content: CURRENT_VENDOR_POLICY.content,
            policyVersion: CURRENT_VENDOR_POLICY.policyVersion,
        });
    }

    private makeAutoVersion(): string {
        const date = new Date();
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        const hours = String(date.getUTCHours()).padStart(2, "0");
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        const seconds = String(date.getUTCSeconds()).padStart(2, "0");
        return `vendor_terms_${year}_${month}_${day}_${hours}${minutes}${seconds}`;
    }

    private async notifyVendorsOfPolicyUpdate(policy: ICurrentVendorPolicyDto): Promise<void> {
        const vendors = await this.userRepository.find({
            where: { userType: UserRole.VENDOR },
            relations: ["profile"],
        });
        if (vendors.length === 0) return;

        const partnerPortalUrl = CONFIG.partner_domain.url || "https://partner.gokhor.com";
        await Promise.allSettled(vendors
            .filter((vendor) => !!vendor.email)
            .map((vendor) => this.sendEmailService.sendVendorPolicyUpdateEmail({
                to: vendor.email,
                recipientName: vendor.profile?.username || null,
                title: policy.title,
                content: policy.content,
                partnerPortalUrl,
                metadata: {
                    userId: vendor.id,
                    policyVersion: policy.policyVersion,
                },
            })));
    }

    async getCurrentPolicy(): Promise<ICurrentVendorPolicyDto> {
        const setting = await this.platformSettingRepository.findOne({
            where: { setting_key: this.settingKey },
        });
        if (!setting) {
            return this.getFallbackPolicy();
        }

        try {
            const parsed = JSON.parse(setting.setting_value) as Partial<StoredVendorPolicy>;
            if (!parsed?.policyVersion?.trim() || !parsed?.title?.trim() || !parsed?.content?.trim()) {
                return this.getFallbackPolicy();
            }
            return this.buildPolicy({
                policyVersion: parsed.policyVersion.trim(),
                title: parsed.title.trim(),
                content: parsed.content.trim(),
            });
        } catch {
            return this.getFallbackPolicy();
        }
    }

    async updateCurrentPolicy(payload: IUpdateVendorPolicyDto): Promise<ICurrentVendorPolicyDto> {
        const next = {
            title: payload.title?.trim(),
            content: payload.content?.trim(),
        };

        if (!next.title || !next.content) {
            throw new Error("title and content are required.");
        }

        const current = await this.getCurrentPolicy();
        const policyVersion = this.makeAutoVersion();

        let setting = await this.platformSettingRepository.findOne({
            where: { setting_key: this.settingKey },
        });
        if (!setting) {
            setting = this.platformSettingRepository.create({
                setting_key: this.settingKey,
                setting_value: JSON.stringify({ ...next, policyVersion }),
            });
        } else {
            setting.setting_value = JSON.stringify({ ...next, policyVersion });
        }
        await this.platformSettingRepository.save(setting);

        const updatedPolicy = this.buildPolicy({
            ...next,
            policyVersion,
        });

        if (current.title !== updatedPolicy.title || current.content !== updatedPolicy.content) {
            await this.notifyVendorsOfPolicyUpdate(updatedPolicy);
        }

        return updatedPolicy;
    }
}
