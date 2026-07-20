import { AppDataSource } from "./src/config/ormconfig";
import { VendorSubscription } from "./src/modules/user/entity/user/vendor-subscription.entity";

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(VendorSubscription);
  
  const freeSubs = await repo.find({ where: { subscription_type: "free" as any } });
  console.log("Found " + freeSubs.length + " free subscriptions");
  
  for (const sub of freeSubs) {
    sub.subscription_type = "monthly" as any;
    // We should also set status to pending or active?
    // Let's just update the type for now.
    await repo.save(sub);
  }
  
  console.log("Updated to monthly.");
  await AppDataSource.destroy();
}
run().catch(console.error);
