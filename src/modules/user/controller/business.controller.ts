import { FastifyReply, FastifyRequest } from "fastify";
import { BusinessService } from "../service/business.service";


export class BusinessController {

  constructor(private readonly businessService: BusinessService) {}

    async createBusinessType(
        req: FastifyRequest<{ Body: any }>,
        reply: FastifyReply
    ){
        try{
            const { name } = req.body as { name: string };
            const businessType = await this.businessService.createBusinessType(name);
            reply.code(201).send(businessType);
        }catch (error: any) {
            let parsedError = { message: 'Error creating BusinessType', code: '10001' };

            try {
                parsedError = JSON.parse(error.message);
            } catch (_) {
                parsedError.message = error.message;
            }

            reply.code(400).send(parsedError);
        }
    }

    async createBusiness(
        req: FastifyRequest<{ Body: any }>,
        reply: FastifyReply
    ){
        try{
            const { userUUID, businessTypeIds } = req.body as { userUUID: string; businessTypeIds: number[] };
            const properties = await this.businessService.createBusiness(userUUID, businessTypeIds);
            reply.code(201).send(properties);
        }catch (error: any) {
            let parsedError = { message: 'Error creating Business', code: '10002' };

            try {
                parsedError = JSON.parse(error.message);
            } catch (_) {
                parsedError.message = error.message;
            }

            reply.code(400).send(parsedError);
        }
    }

    async businessSetup(
        req: FastifyRequest<{ Body: any }>,
        reply: FastifyReply
    ){
        try{
            const {
                userUUID,
                businessTypes,
                CNIC,
                businessName,
                locationId,
                street_address,
                landmark,
                is_primary
            } = req.body as {
                userUUID: string;
                businessTypes: string[];
                CNIC: string;
                businessName: string;
                locationId: number;
                street_address: string;
                landmark: string;
                is_primary: boolean;
            };
            const vendor = await this.businessService.businessSetup(
                userUUID,
                businessTypes,
                CNIC,
                businessName,
                locationId,
                street_address,
                landmark,
                is_primary
            );
            reply.code(201).send(vendor);
        }catch (error: any) {
            let parsedError = { message: 'Error setting up Business', code: '10003' };

            try {
                parsedError = JSON.parse(error.message);
            } catch (_) {
                parsedError.message = error.message;
            }

            reply.code(400).send(parsedError);
        }
    }

}