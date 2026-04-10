import { AppDataSource } from "@config/ormconfig";
import { SubscriptionPlan } from "@modules/user/entity/subscription-plan.entity";
import { SubscriptionType } from "@common/enums";
import {
    ISubscriptionPlanDTO,
    ICreateSubscriptionPlanDTO,
    IUpdateSubscriptionPlanDTO,
    IFeaturedPricingDTO,
} from "@modules/user/dtos";
import { SUBSCRIPTION_PRICES, FEATURED_AD_PRICE } from "@common/constants";

export class SubscriptionPlanService {
    private planRepository = AppDataSource.getRepository(SubscriptionPlan);

    private calculateSavings(
        price: number,
        durationDays: number,
        monthlyPrice: number
    ): { savings: number; savings_percentage: number } {
        const monthlyEquivalent = (durationDays / 30) * monthlyPrice;
        const savings = monthlyEquivalent - price;
        const percentage = (savings / monthlyEquivalent) * 100;
        return {
            savings: Math.round(savings),
            savings_percentage: Math.round(percentage),
        };
    }

    private toPlanDTO(plan: SubscriptionPlan, monthlyPrice?: number): ISubscriptionPlanDTO {
        const dto: ISubscriptionPlanDTO = {
            plan_id: plan.plan_id,
            type: plan.type as SubscriptionType,
            name: plan.name,
            duration_days: plan.duration_days,
            price: Number(plan.price),
            price_per_day: Math.round(Number(plan.price) / plan.duration_days),
            description: plan.description || "",
            features: plan.features || [],
            is_popular: plan.is_popular,
            is_active: plan.is_active,
            display_order: plan.display_order,
            created_at: plan.created_at,
            updated_at: plan.updated_at,
        };

        // Calculate savings if monthly price is provided and plan is not free
        if (monthlyPrice && plan.type !== SubscriptionType.FREE && plan.duration_days > 30) {
            const savingsData = this.calculateSavings(
                Number(plan.price),
                plan.duration_days,
                monthlyPrice
            );
            dto.savings = savingsData.savings;
            dto.savings_percentage = savingsData.savings_percentage;
        }

        return dto;
    }

    async seedDefaultPlans(): Promise<void> {
        const existingPlans = await this.planRepository.count();
        if (existingPlans > 0) {
            return; // Already seeded
        }

        const defaultPlans: ICreateSubscriptionPlanDTO[] = [
            {
                type: SubscriptionType.FREE,
                name: "Free Trial",
                duration_days: 30,
                price: 0,
                description: "Perfect for testing the platform",
                features: [
                    "30 days listing",
                    "Basic visibility",
                    "Standard support",
                    "Single location",
                ],
                is_popular: false,
                display_order: 1,
            },
            {
                type: SubscriptionType.MONTHLY,
                name: "Monthly Plan",
                duration_days: 30,
                price: SUBSCRIPTION_PRICES.MONTHLY,
                description: "Ideal for short-term promotions",
                features: [
                    "30 days listing",
                    "Enhanced visibility",
                    "Priority support",
                    "Multiple images",
                    "Analytics dashboard",
                ],
                is_popular: false,
                display_order: 2,
            },
            {
                type: SubscriptionType.QUARTERLY,
                name: "Quarterly Plan",
                duration_days: 90,
                price: SUBSCRIPTION_PRICES.QUARTERLY,
                description: "Best value for established businesses",
                features: [
                    "90 days listing",
                    "Premium visibility",
                    "Priority support",
                    "Unlimited images",
                    "Advanced analytics",
                    "10% discount",
                ],
                is_popular: true,
                display_order: 3,
            },
            {
                type: SubscriptionType.YEARLY,
                name: "Yearly Plan",
                duration_days: 365,
                price: SUBSCRIPTION_PRICES.YEARLY,
                description: "Maximum savings for long-term advertisers",
                features: [
                    "365 days listing",
                    "Premium visibility",
                    "VIP support",
                    "Unlimited images",
                    "Advanced analytics",
                    "Featured badge",
                    "20% discount",
                ],
                is_popular: false,
                display_order: 4,
            },
        ];

        for (const planData of defaultPlans) {
            await this.createPlan(planData);
        }
    }

    async getAllPlans(includeInactive = false): Promise<ISubscriptionPlanDTO[]> {
        const whereCondition = includeInactive ? {} : { is_active: true };
        const plans = await this.planRepository.find({
            where: whereCondition,
            order: { display_order: "ASC", created_at: "ASC" },
        });

        // Get monthly price for savings calculation
        const monthlyPlan = plans.find((p) => p.type === SubscriptionType.MONTHLY);
        const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : SUBSCRIPTION_PRICES.MONTHLY;

        return plans.map((plan) => this.toPlanDTO(plan, monthlyPrice));
    }

    async getPlanByType(type: SubscriptionType): Promise<ISubscriptionPlanDTO | null> {
        const plan = await this.planRepository.findOne({ where: { type } });
        if (!plan) {
            return null;
        }

        const monthlyPlan = await this.planRepository.findOne({
            where: { type: SubscriptionType.MONTHLY },
        });
        const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : SUBSCRIPTION_PRICES.MONTHLY;

        return this.toPlanDTO(plan, monthlyPrice);
    }

    async getPlanById(planId: string): Promise<ISubscriptionPlanDTO | null> {
        const plan = await this.planRepository.findOne({ where: { plan_id: planId } });
        if (!plan) {
            return null;
        }

        const monthlyPlan = await this.planRepository.findOne({
            where: { type: SubscriptionType.MONTHLY },
        });
        const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : SUBSCRIPTION_PRICES.MONTHLY;

        return this.toPlanDTO(plan, monthlyPrice);
    }

    async createPlan(planData: ICreateSubscriptionPlanDTO): Promise<ISubscriptionPlanDTO> {
        const plan = new SubscriptionPlan();
        plan.type = planData.type;
        plan.name = planData.name;
        plan.duration_days = planData.duration_days;
        plan.price = planData.price;
        plan.description = planData.description || "";
        plan.features = planData.features || [];
        plan.is_popular = planData.is_popular ?? false;
        plan.is_active = planData.is_active ?? true;
        plan.display_order = planData.display_order ?? 0;

        const savedPlan = await this.planRepository.save(plan);

        const monthlyPlan = await this.planRepository.findOne({
            where: { type: SubscriptionType.MONTHLY },
        });
        const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : SUBSCRIPTION_PRICES.MONTHLY;

        return this.toPlanDTO(savedPlan, monthlyPrice);
    }

    async updatePlan(
        planId: string,
        updateData: IUpdateSubscriptionPlanDTO
    ): Promise<ISubscriptionPlanDTO> {
        const plan = await this.planRepository.findOne({ where: { plan_id: planId } });

        if (!plan) {
            throw new Error("Plan not found");
        }

        if (updateData.name !== undefined) plan.name = updateData.name;
        if (updateData.duration_days !== undefined) plan.duration_days = updateData.duration_days;
        if (updateData.price !== undefined) plan.price = updateData.price;
        if (updateData.description !== undefined) plan.description = updateData.description;
        if (updateData.features !== undefined) plan.features = updateData.features;
        if (updateData.is_popular !== undefined) plan.is_popular = updateData.is_popular;
        if (updateData.is_active !== undefined) plan.is_active = updateData.is_active;
        if (updateData.display_order !== undefined) plan.display_order = updateData.display_order;

        const updatedPlan = await this.planRepository.save(plan);

        const monthlyPlan = await this.planRepository.findOne({
            where: { type: SubscriptionType.MONTHLY },
        });
        const monthlyPrice = monthlyPlan ? Number(monthlyPlan.price) : SUBSCRIPTION_PRICES.MONTHLY;

        return this.toPlanDTO(updatedPlan, monthlyPrice);
    }

    async deletePlan(planId: string): Promise<void> {
        const plan = await this.planRepository.findOne({ where: { plan_id: planId } });

        if (!plan) {
            throw new Error("Plan not found");
        }

        await this.planRepository.remove(plan);
    }

    async getFeaturedPricing(): Promise<IFeaturedPricingDTO> {
        return {
            price: FEATURED_AD_PRICE,
            description: "Premium placement at the top of search results",
        };
    }

    async comparePlans(): Promise<{
        plans: ISubscriptionPlanDTO[];
        featured_pricing: IFeaturedPricingDTO;
        recommended: SubscriptionType;
    }> {
        const plans = await this.getAllPlans();
        const featured = await this.getFeaturedPricing();

        // Find most popular plan or default to quarterly
        const popularPlan = plans.find((p) => p.is_popular);
        const recommended = popularPlan ? popularPlan.type as SubscriptionType : SubscriptionType.QUARTERLY;

        return {
            plans,
            featured_pricing: featured,
            recommended,
        };
    }
}
