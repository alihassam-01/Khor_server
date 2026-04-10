import { AppDataSource } from "@config/ormconfig";
import { PaymentSetting } from "@modules/user/entity/ads/payment-setting.entity";
import {
    ICreatePaymentSettingDTO,
    IUpdatePaymentSettingDTO,
    IPaymentSettingDTO,
} from "@modules/user/dtos";
import { PaymentMethod } from "@common/enums";

export class PaymentSettingService {
    private settingRepository = AppDataSource.getRepository(PaymentSetting);

    private toDTO(setting: PaymentSetting): IPaymentSettingDTO {
        return {
            id: setting.id,
            method: setting.method as PaymentMethod,
            account_name: setting.account_name,
            account_number: setting.account_number,
            bank_name: setting.bank_name || "",
            branch_code: setting.branch_code || "",
            is_active: setting.is_active,
            notes: setting.notes || "",
            created_at: setting.created_at,
            updated_at: setting.updated_at,
        };
    }

    async createSetting(data: ICreatePaymentSettingDTO): Promise<IPaymentSettingDTO> {
        const setting = new PaymentSetting();
        setting.method = data.method;
        setting.account_name = data.account_name;
        setting.account_number = data.account_number;
        setting.bank_name = data.bank_name;
        setting.branch_code = data.branch_code;
        setting.is_active = data.is_active ?? true;
        setting.notes = data.notes;

        const savedSetting = await this.settingRepository.save(setting);
        return this.toDTO(savedSetting);
    }

    async updateSetting(id: string, data: IUpdatePaymentSettingDTO): Promise<IPaymentSettingDTO> {
        const setting = await this.settingRepository.findOne({ where: { id } });
        if (!setting) {
            throw new Error("Payment setting not found");
        }

        if (data.method !== undefined) setting.method = data.method;
        if (data.account_name !== undefined) setting.account_name = data.account_name;
        if (data.account_number !== undefined) setting.account_number = data.account_number;
        if (data.bank_name !== undefined) setting.bank_name = data.bank_name;
        if (data.branch_code !== undefined) setting.branch_code = data.branch_code;
        if (data.is_active !== undefined) setting.is_active = data.is_active;
        if (data.notes !== undefined) setting.notes = data.notes;

        const updatedSetting = await this.settingRepository.save(setting);
        return this.toDTO(updatedSetting);
    }

    async getAllSettings(): Promise<IPaymentSettingDTO[]> {
        const settings = await this.settingRepository.find({ order: { method: "ASC" } });
        return settings.map((s) => this.toDTO(s));
    }

    async getActiveSettings(): Promise<IPaymentSettingDTO[]> {
        const settings = await this.settingRepository.find({
            where: { is_active: true },
            order: { method: "ASC" },
        });
        return settings.map((s) => this.toDTO(s));
    }

    async getSettingByMethod(method: PaymentMethod): Promise<IPaymentSettingDTO | null> {
        const setting = await this.settingRepository.findOne({ where: { method, is_active: true } });
        return setting ? this.toDTO(setting) : null;
    }

    async deleteSetting(id: string): Promise<void> {
        const setting = await this.settingRepository.findOne({ where: { id } });
        if (!setting) {
            throw new Error("Payment setting not found");
        }
        await this.settingRepository.remove(setting);
    }
}
