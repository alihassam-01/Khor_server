import puppeteer from "puppeteer";
import { bookingConfirmationTemplate } from "./bookingConfirmation";
import { BookingConfirmation } from "@modules/user/dtos/bookingConfirmation.dto";

const GeneratePDF = async (bookingInfo: BookingConfirmation) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // TODO: plan has to be added
  const html = bookingConfirmationTemplate(bookingInfo as any);
  await page.setContent(html);

  // Generate PDF buffer
  const pdfBuffer = await page.pdf({ format: "A4" });

  await browser.close();
  return pdfBuffer;
};

export default GeneratePDF;
