import { FastifyInstance } from 'fastify';
import { RoomTypeService } from '../service/roomtype.service';
import { RoomType } from '../entity/room';

export async function roomTypeController(app: FastifyInstance) {
  const service = new RoomTypeService();

  app.post('/room-types', async (req, reply) => {
    const rt = await service.create(req.body as Partial<RoomType>);
    reply.send(rt);
  });

  app.get('/room-types/property/:propertyId', async (req, reply) => {
    const { propertyId } = req.params as { propertyId: string };
    const rts = await service.findByProperty(propertyId);
    reply.send(rts);
  });
}