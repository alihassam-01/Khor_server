import { PublicPolicyService } from "./public-policy.service";
import { IPublicPoliciesDto, IUpdatePublicPoliciesDto } from "@modules/user/types/public-policy.types";

export class AdminPublicPolicyService {
    private readonly publicPolicyService = new PublicPolicyService();

    async getCurrentPolicies(): Promise<IPublicPoliciesDto> {
        return this.publicPolicyService.getCurrentPolicies();
    }

    async updateCurrentPolicies(payload: IUpdatePublicPoliciesDto): Promise<IPublicPoliciesDto> {
        return this.publicPolicyService.updateCurrentPolicies(payload);
    }
}
