import { FlightsService } from "../modules/user/service/flights.service";
async function run() {
    const srv = new FlightsService();
    const opts = {
        from: "ISB",
        to: "KDU",
        date: "2026-06-24",
        trip: "one-way" as const,
        seat: "economy" as const,
        adults: 1,
        children: 0,
        currency: "PKR",
        language: "en-US"
    };

    console.log("Fetching Calendar...");
    try {
        const cal = await srv.searchCalendar({ ...opts, date: "2026-06-01" });
        console.log("Calendar length:", cal.length);
        const day17 = cal.find(d => d.date === "2026-06-17");
        console.log("Calendar price for 2026-06-17:", day17?.price);
    } catch (e) {
        console.error("Calendar failed:", e);
    }

    console.log("\nFetching Search...");
    try {
        const res = await srv.searchFlights(opts);
        console.log("Search results count:", res.results.length);
        console.log("Lowest price in search:", res.lowestPrice);
        if (res.results.length > 0) {
             console.log("First result price:", res.results[0].price);
             console.log("First result airline:", res.results[0].airlines);
        }
    } catch (e) {
        console.error("Search failed:", e);
    }
}
run().catch(console.error);
