import { PaymentMethod } from "@common/enums/payment.enums";

export interface IPaymentSettingDTO {
    id: string;
    method: PaymentMethod;
    account_name: string;
    account_number: string;
    bank_name?: string;
    branch_code?: string;
    is_active: boolean;
    notes?: string;
    created_at: Date;
    updated_at: Date;
}

export interface ICreatePaymentSettingDTO {
    method: PaymentMethod;
    account_name: string;
    account_number: string;
    bank_name?: string;
    branch_code?: string;
    is_active?: boolean;
    notes?: string;
}

export interface IUpdatePaymentSettingDTO {
    method?: PaymentMethod;
    account_name?: string;
    account_number?: string;
    bank_name?: string;
    branch_code?: string;
    is_active?: boolean;
    notes?: string;
}
