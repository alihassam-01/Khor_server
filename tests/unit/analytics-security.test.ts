import assert from "node:assert/strict";
import test from "node:test";
import { AnalyticsEventType } from "@common/enums/analytics.enums";
import { ListingType } from "@common/enums/listing.enums";
import { PropertyType } from "@common/enums/property.enums";
import { AnalyticsService } from "@modules/user/service/analytics.service";

const createService = () => {
  const service = new AnalyticsService() as any;
  const inserted: any[][] = [];
  service.analyticsRepository = {
    insert: async (rows: any[]) => {
      inserted.push(rows);
    },
  };
  service.listingRepository = {
    find: async () => [{
      id: "listing-1",
      type: ListingType.HOTEL,
      is_active: true,
      is_public_visible: true,
    }],
  };
  return { service, inserted };
};

test("analytics ingestion validates listings and collapses duplicate events", async () => {
  const { service, inserted } = createService();
  const timestamp = Date.now();
  const event = {
    adId: "listing-1",
    adType: PropertyType.HOTEL,
    type: AnalyticsEventType.VIEW,
    timestamp,
  };

  await service.saveBatch([event, event], "ip-hash");

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].length, 1);
  assert.equal(inserted[0][0].listing_type, ListingType.HOTEL);
});

test("analytics ingestion rejects oversized and stale batches", async () => {
  const { service } = createService();
  const validEvent = {
    adId: "listing-1",
    adType: PropertyType.HOTEL,
    type: AnalyticsEventType.VIEW,
    timestamp: Date.now(),
  };

  await assert.rejects(
    service.saveBatch(Array.from({ length: 51 }, () => ({ ...validEvent })), "ip-hash"),
    /limited to 50 events/,
  );
  await assert.rejects(
    service.saveBatch([{
      ...validEvent,
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
    }], "ip-hash"),
    /Invalid analytics event/,
  );
});

test("analytics ingestion rejects unavailable or mismatched listings", async () => {
  const { service } = createService();
  service.listingRepository.find = async () => [];

  await assert.rejects(
    service.saveBatch([{
      adId: "listing-1",
      adType: PropertyType.HOTEL,
      type: AnalyticsEventType.CLICK,
      timestamp: Date.now(),
    }], "ip-hash"),
    /invalid or unavailable/,
  );
});
