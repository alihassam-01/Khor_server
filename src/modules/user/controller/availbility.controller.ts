import { FastifyInstance } from 'fastify';
import { AvailabilityService } from '../service/availbility.service';
import { Availability } from '../entity/property/availbility.entity';

export async function availabilityController(app: FastifyInstance) {
  const service = new AvailabilityService();

  app.post('/availability', async (req, reply) => {
    const avail = await service.create(req.body as Partial<Availability>);
    reply.send(avail);
  });

//   app.get('/availability', async (req, reply) => {
//     const { resourceType, resourceId, date } = req.query as any;
//     const avail = await service.find(resourceType, resourceId, new Date(date));
//     reply.send(avail);
//   });
}