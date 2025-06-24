import { FastifyInstance } from 'fastify';
import { TourPackageService } from '../service/tourpackage.service';
import { TourPackage } from '../entity/property/tour-package.entity';

export async function tourPackageController(app: FastifyInstance) {
  const service = new TourPackageService();

  app.post('/tour-packages', async (req, reply) => {
    const tp = await service.create(req.body as Partial<TourPackage>);
    reply.send(tp);
  });

  app.get('/tour-packages/property/:propertyId', async (req, reply) => {
    const { propertyId } = req.params as { propertyId: string };
    const tps = await service.findByProperty(propertyId);
    reply.send(tps);
  });
}
