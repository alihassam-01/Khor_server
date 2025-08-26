import { FastifyReply, FastifyRequest } from "fastify";
import { ListingPriceService } from "../service";
import { ListingPrice } from "../entity/payout";

export class ListingPriceController {
  private listingPriceService = new ListingPriceService();

  // async createListing(req: Request, res: Response) {
  //     const data = req.body;
  //     try {
  //         const listing = await this.listingPriceService.create(data);
  //         res.status(201).json(listing);
  //     } catch (error) {
  //         res.status(500).json({ error: error.message });
  //     }
  // }

  async getAllListings(_req: FastifyRequest, res: FastifyReply) {
    try {
      const listings = await this.listingPriceService.findAll();
      res.status(200).send(listings);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  }

  async getListingById(
    req: FastifyRequest<{ Params: { id: string } }>,
    res: FastifyReply
  ) {
    const { id } = req.params;
    try {
      const listing = await this.listingPriceService.findById(id);
      if (!listing) {
        return res.status(404).send({ error: "Listing not found" });
      }
      res.status(200).send(listing);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  }

  async updateListing(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { data: Partial<ListingPrice> };
    }>,
    res: FastifyReply
  ) {
    const { id } = req.params;
    const data = req.body.data;
    try {
      const updatedListing = await this.listingPriceService.update(id, data);
      if (!updatedListing) {
        return res.status(404).send({ error: "Listing not found" });
      }
      res.status(200).send(updatedListing);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  }

  async deleteListing(
    req: FastifyRequest<{ Params: { id: string } }>,
    res: FastifyReply
  ) {
    const { id } = req.params;
    try {
      await this.listingPriceService.delete(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  }

  async changeCommissionRate(
    req: FastifyRequest<{
      Params: { id: string };
      Body: { commissionRate: number };
    }>,
    res: FastifyReply
  ) {
    const { id } = req.params;
    const { commissionRate } = req.body;
    try {
      const updatedListing =
        await this.listingPriceService.changeCommissionRate(id, commissionRate);
      if (!updatedListing) {
        return res.status(404).send({ error: "Listing not found" });
      }
      res.status(200).send(updatedListing);
    } catch (error: any) {
      res.status(500).send({ error: error.message });
    }
  }
}
