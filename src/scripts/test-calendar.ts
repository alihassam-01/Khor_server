import { FlightsService } from "../modules/user/service/flights.service";
async function run() {
    const srv = new FlightsService();
    const res = await srv.searchCalendar({
        from: "ISB",
        to: "KDU",
        date: "2026-06-01",
        trip: "one-way",
        adults: 1,
        children: 0,
        currency: "PKR"
    });
    console.log("Calendar length:", res.length);
    console.log(JSON.stringify(res.slice(0, 3), null, 2));
}
run().catch(console.error);
