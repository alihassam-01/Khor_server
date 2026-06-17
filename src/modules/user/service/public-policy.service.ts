import * as crypto from "crypto";
import { AppDataSource } from "@config/ormconfig";
import { PlatformSetting } from "@modules/user/entity/payment/platform-setting.entity";
import {
    IPublicPoliciesDto,
    IPublicPolicyItemDto,
    IUpdatePublicPoliciesDto,
    PublicPolicyKind,
} from "@modules/user/types/public-policy.types";
import { CURRENT_PUBLIC_POLICIES } from "./public-policy.content";

type StoredPublicPolicyItem = {
    title: string;
    content: string;
    policyVersion: string;
    lastUpdated: string;
};

type StoredPublicPolicies = Record<PublicPolicyKind, StoredPublicPolicyItem>;

export class PublicPolicyService {
    private readonly platformSettingRepository = AppDataSource.getRepository(PlatformSetting);
    private readonly settingKey = "public_policies_current";

    private buildItem(policyType: PublicPolicyKind, payload: StoredPublicPolicyItem): IPublicPolicyItemDto {
        return {
            policyType,
            title: payload.title,
            content: payload.content,
            policyVersion: payload.policyVersion,
            lastUpdated: payload.lastUpdated,
            contentHash: crypto.createHash("sha256").update(payload.content).digest("hex"),
        };
    }

    private getFallbackPolicies(): IPublicPoliciesDto {
        return CURRENT_PUBLIC_POLICIES;
    }

    private makeAutoVersion(policyType: PublicPolicyKind): string {
        const date = new Date();
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");
        const hours = String(date.getUTCHours()).padStart(2, "0");
        const minutes = String(date.getUTCMinutes()).padStart(2, "0");
        const seconds = String(date.getUTCSeconds()).padStart(2, "0");
        return `${policyType}_${year}_${month}_${day}_${hours}${minutes}${seconds}`;
    }

    private buildStoredFromDto(dto: IPublicPoliciesDto): StoredPublicPolicies {
        return {
            privacy: {
                title: dto.privacy.title,
                content: dto.privacy.content,
                policyVersion: dto.privacy.policyVersion,
                lastUpdated: dto.privacy.lastUpdated,
            },
            terms: {
                title: dto.terms.title,
                content: dto.terms.content,
                policyVersion: dto.terms.policyVersion,
                lastUpdated: dto.terms.lastUpdated,
            },
            refund: {
                title: dto.refund.title,
                content: dto.refund.content,
                policyVersion: dto.refund.policyVersion,
                lastUpdated: dto.refund.lastUpdated,
            },
        };
    }

    async getCurrentPolicies(): Promise<IPublicPoliciesDto> {
        const setting = await this.platformSettingRepository.findOne({
            where: { setting_key: this.settingKey },
        });
        if (!setting) {
            return this.getFallbackPolicies();
        }

        try {
            const parsed = JSON.parse(setting.setting_value) as Partial<StoredPublicPolicies>;
            const fallback = this.getFallbackPolicies();
            const privacy = parsed.privacy;
            const terms = parsed.terms;
            const refund = parsed.refund;

            if (!privacy?.title?.trim() || !privacy?.content?.trim() || !privacy?.policyVersion?.trim() || !privacy?.lastUpdated?.trim()) {
                return fallback;
            }
            if (!terms?.title?.trim() || !terms?.content?.trim() || !terms?.policyVersion?.trim() || !terms?.lastUpdated?.trim()) {
                return fallback;
            }
            if (!refund?.title?.trim() || !refund?.content?.trim() || !refund?.policyVersion?.trim() || !refund?.lastUpdated?.trim()) {
                return fallback;
            }

            return {
                privacy: this.buildItem("privacy", privacy),
                terms: this.buildItem("terms", terms),
                refund: this.buildItem("refund", refund),
            };
        } catch {
            return this.getFallbackPolicies();
        }
    }

    async updateCurrentPolicies(payload: IUpdatePublicPoliciesDto): Promise<IPublicPoliciesDto> {
        const current = await this.getCurrentPolicies();
        const nowDate = new Date().toISOString().slice(0, 10);

        const next: IPublicPoliciesDto = {
            privacy: {
                ...current.privacy,
                title: payload.privacy.title.trim(),
                content: payload.privacy.content.trim(),
            },
            terms: {
                ...current.terms,
                title: payload.terms.title.trim(),
                content: payload.terms.content.trim(),
            },
            refund: {
                ...current.refund,
                title: payload.refund.title.trim(),
                content: payload.refund.content.trim(),
            },
        };

        (["privacy", "terms", "refund"] as const).forEach((policyType) => {
            if (!next[policyType].title || !next[policyType].content) {
                throw new Error(`${policyType} title and content are required.`);
            }
            if (
                next[policyType].title !== current[policyType].title
                || next[policyType].content !== current[policyType].content
            ) {
                next[policyType].policyVersion = this.makeAutoVersion(policyType);
                next[policyType].lastUpdated = nowDate;
                next[policyType].contentHash = crypto.createHash("sha256").update(next[policyType].content).digest("hex");
            }
        });

        let setting = await this.platformSettingRepository.findOne({
            where: { setting_key: this.settingKey },
        });
        const stored = this.buildStoredFromDto(next);
        if (!setting) {
            setting = this.platformSettingRepository.create({
                setting_key: this.settingKey,
                setting_value: JSON.stringify(stored),
            });
        } else {
            setting.setting_value = JSON.stringify(stored);
        }

        await this.platformSettingRepository.save(setting);
        return next;
    }
}
