export type PublicPolicyKind = "privacy" | "terms" | "refund";

export interface IPublicPolicyItemDto {
    policyType: PublicPolicyKind;
    title: string;
    content: string;
    policyVersion: string;
    contentHash: string;
    lastUpdated: string;
}

export interface IPublicPoliciesDto {
    privacy: IPublicPolicyItemDto;
    terms: IPublicPolicyItemDto;
    refund: IPublicPolicyItemDto;
}

export interface IUpdatePublicPolicyItemDto {
    title: string;
    content: string;
}

export interface IUpdatePublicPoliciesDto {
    privacy: IUpdatePublicPolicyItemDto;
    terms: IUpdatePublicPolicyItemDto;
    refund: IUpdatePublicPolicyItemDto;
}
