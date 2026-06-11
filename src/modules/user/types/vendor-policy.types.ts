export interface ICurrentVendorPolicyDto {
    policyType: "vendor_terms";
    policyVersion: string;
    title: string;
    content: string;
    contentHash: string;
}

export interface IUpdateVendorPolicyDto {
    title: string;
    content: string;
}
