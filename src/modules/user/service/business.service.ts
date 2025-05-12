import { AppDataSource } from "@config/ormconfig";
import { BusinessType, Vendor } from "../entity/business";
import { Property } from "../entity/property";

export class BusinessService {
  private businessTypeRepository = AppDataSource.getRepository(BusinessType);
  private propertyRepository = AppDataSource.getRepository(Property);
  private vendorRepository = AppDataSource.getRepository(Vendor);

  async createBusinessType(name: string): Promise<BusinessType> {
    const newBusinessType = this.businessTypeRepository.create({ name });
    return await this.businessTypeRepository.save(newBusinessType);
  }
  async createBusiness(
    userUUID: string,
    businessTypeIds: number[]
  ): Promise<Property[]> {
    const vendor = await this.vendorRepository.findOneByOrFail({
      id: userUUID,
    });
    console.log("vendor", vendor);
    const properties: Property[] = businessTypeIds.map((businessTypeId) =>
      this.propertyRepository.create({
        vendor: vendor,
        businessType: { id: businessTypeId } as BusinessType,
      })
    );

    return await this.propertyRepository.save(properties);
  }
}
