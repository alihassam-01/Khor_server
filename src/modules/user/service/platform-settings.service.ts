import { AppDataSource } from "@config/ormconfig";
import { PlatformSetting } from "@modules/user/entity/payment/platform-setting.entity";
import { EntityManager } from "typeorm";

export class PlatformSettingsService {
    private repo = AppDataSource.getRepository(PlatformSetting);

    async getAllSettings(): Promise<Record<string, string>> {
        const settings = await this.repo.find();
        return settings.reduce((acc, curr) => {
            acc[curr.setting_key] = curr.setting_value;
            return acc;
        }, {} as Record<string, string>);
    }

    async getSetting(key: string, defaultValue: string = "", em?: EntityManager): Promise<string> {
        const repository = em ? em.getRepository(PlatformSetting) : this.repo;
        const setting = await repository.findOne({ where: { setting_key: key } });
        return setting ? setting.setting_value : defaultValue;
    }

    async updateSettings(settings: Record<string, string>): Promise<void> {
        await this.repo.manager.transaction(async (em) => {
            const repository = em.getRepository(PlatformSetting);
            for (const [key, value] of Object.entries(settings)) {
                let setting = await repository.findOne({ where: { setting_key: key } });
                if (!setting) {
                    setting = repository.create({ setting_key: key, setting_value: String(value) });
                } else {
                    setting.setting_value = String(value);
                }
                await repository.save(setting);
            }
        });
    }
}
