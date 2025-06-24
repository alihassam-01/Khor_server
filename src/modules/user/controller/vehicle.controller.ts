import { FastifyInstance } from 'fastify';
import { VehicleService } from '../service/vehicle.service';
import { Vehicle } from '../entity/property/vehicle.entity';

export async function vehicleController(app: FastifyInstance) {
  const service = new VehicleService();

  app.post('/vehicles', async (req, reply) => {
    const vehicle = await service.create(req.body as Partial<Vehicle>);
    reply.send(vehicle);
  });

  app.get('/vehicles/property/:propertyId', async (req, reply) => {
    const { propertyId } = req.params as { propertyId: string };
    const v = await service.findByProperty(propertyId);
    reply.send(v);
  });
}
