import { HotelPromotion } from "@modules/user/entity/listing";

export type ActivePromotionSummary = {
    id: string;
    name: string;
    discount_type: "percentage" | "fixed";
    discount_value: number;
    applies_to: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    usage_count: number;
    savings_amount: number;
    discounted_price: number;
    percentage_off: number;
};

const roundMoney = (value: number) => Math.max(0, Math.round(value * 100) / 100);

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);

export const isPromotionActive = (
    promotion: Pick<HotelPromotion, "is_active" | "start_date" | "end_date">,
    at: Date = new Date(),
): boolean => {
    if (!promotion.is_active) return false;
    const today = toDateOnly(at);
    return promotion.start_date <= today && promotion.end_date >= today;
};

export const doesPromotionApplyToRoom = (
    promotion: Pick<HotelPromotion, "applies_to">,
    roomTypeValue?: string | null,
): boolean => {
    const target = (promotion.applies_to || "all").toLowerCase();
    if (target === "all") return true;
    if (!roomTypeValue) return false;
    return target === String(roomTypeValue).toLowerCase();
};

export const summarizePromotion = (
    basePrice: number,
    promotion: HotelPromotion,
): ActivePromotionSummary => {
    const numericBase = roundMoney(basePrice);
    const numericValue = roundMoney(Number(promotion.discount_value));
    const discountedPrice = promotion.discount_type === "percentage"
        ? roundMoney(numericBase * (1 - (numericValue / 100)))
        : roundMoney(numericBase - numericValue);
    const savingsAmount = roundMoney(numericBase - discountedPrice);
    const percentageOff = numericBase > 0
        ? Math.max(0, Math.min(100, Math.round((savingsAmount / numericBase) * 100)))
        : 0;

    return {
        id: promotion.id,
        name: promotion.name,
        discount_type: promotion.discount_type,
        discount_value: numericValue,
        applies_to: promotion.applies_to,
        start_date: promotion.start_date,
        end_date: promotion.end_date,
        is_active: promotion.is_active,
        usage_count: Number(promotion.usage_count ?? 0),
        savings_amount: savingsAmount,
        discounted_price: discountedPrice,
        percentage_off: percentageOff,
    };
};

export const pickBestPromotion = (
    basePrice: number,
    promotions: HotelPromotion[],
    roomTypeValue?: string | null,
    at: Date = new Date(),
): ActivePromotionSummary | null => {
    const eligible = promotions
        .filter((promotion) => isPromotionActive(promotion, at))
        .filter((promotion) => doesPromotionApplyToRoom(promotion, roomTypeValue))
        .map((promotion) => summarizePromotion(basePrice, promotion))
        .filter((summary) => summary.savings_amount > 0);

    if (eligible.length === 0) return null;

    eligible.sort((left, right) => {
        if (right.savings_amount !== left.savings_amount) {
            return right.savings_amount - left.savings_amount;
        }
        if (left.applies_to === "all" && right.applies_to !== "all") return 1;
        if (left.applies_to !== "all" && right.applies_to === "all") return -1;
        return left.name.localeCompare(right.name);
    });

    return eligible[0];
};
