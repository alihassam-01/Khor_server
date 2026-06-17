import { VendorPolicyService } from "./vendor-policy.service";
import { ICurrentVendorPolicyDto, IUpdateVendorPolicyDto } from "@modules/user/types/vendor-policy.types";

export class AdminVendorPolicyService {
    private readonly vendorPolicyService = new VendorPolicyService();

    async getCurrentPolicy(): Promise<ICurrentVendorPolicyDto> {
        return this.vendorPolicyService.getCurrentPolicy();
    }

    async updateCurrentPolicy(payload: IUpdateVendorPolicyDto): Promise<ICurrentVendorPolicyDto> {
        return this.vendorPolicyService.updateCurrentPolicy(payload);
    }
}
