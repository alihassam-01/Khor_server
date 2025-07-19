import { FastifyInstance } from 'fastify';
import { VendorService } from '../service/vendor.service';
import { Vendor } from '../entity/business';

export async function vendorController(app: FastifyInstance) {
  const service = new VendorService();

  app.post('/vendors', async (req, reply) => {
    const vendor = await service.create(req.body as Partial<Vendor>);
    reply.send(vendor);
  });

  app.get('/vendors/user/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string };
    const vendors = await service.findByUserId(userId);
    reply.send(vendors);
  });
}
