import { FastifyInstance } from 'fastify';
import { DealService } from '../service/deal.service';
import { Deal } from '../entity/bookings/deal.entity';

export async function dealController(app: FastifyInstance) {
  const service = new DealService();

  app.post('/deals', async (req, reply) => {
    const deal = await service.create(req.body as Partial<Deal>);
    reply.send(deal);
  });

  app.get('/deals/property/:propertyId', async (req, reply) => {
    const { propertyId } = req.params as { propertyId: string };
    const deals = await service.findByProperty(propertyId);
    reply.send(deals);
  });
}
