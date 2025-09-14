interface EmailBookingData {
  bookingType: "tour" | "hotel";
  customerName: string;
  propertyName: string | null | undefined;
  roomName?: string;
  packageName?: string;
  locality: string | null;
  city: string | null;
  startDate: string;
  endDate: string;
  totalPrice: number;
  guests: number;
  paymentStatus: string;
  bookingStatus: string;
  vendorEmail?: string;
  vendorPhone?: string;
  plan?: {
    planType: string;
    duration: string;
  };
  // Additional fields that might be passed
  customerInfo?: {
    fullName: string;
    email: string;
    phone: string;
  };
}

export function bookingConfirmationEmailTemplate(
  bookingInfo: EmailBookingData
) {
  // Safe data extraction with fallbacks
  const customerName =
    bookingInfo.customerInfo?.fullName ||
    bookingInfo.customerName ||
    "Customer";
  const propertyName = bookingInfo.propertyName || "Unknown Property";
  const roomName = bookingInfo.roomName || "";
  const locality = bookingInfo.locality || "";
  const city = bookingInfo.city || "";
  const vendorEmail = bookingInfo.vendorEmail || "";
  const vendorPhone = bookingInfo.vendorPhone || "";

  const checkInDate = bookingInfo.startDate
    ? new Date(bookingInfo.startDate).toDateString()
    : "";
  const checkOutDate = bookingInfo.endDate
    ? new Date(bookingInfo.endDate).toDateString()
    : "";

  const totalPrice =
    bookingInfo.totalPrice?.toLocaleString?.() ||
    bookingInfo.totalPrice?.toString() ||
    "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Khor Booking Confirmation</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: 'Arial', sans-serif;
        }
        body {
          background-color: #F3F4F6;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .email-container {
          max-width: 600px;
          background-color: #FFFFFF;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .email-header {
          background-color: #F8F8F8;
          padding: 25px;
          text-align: center;
        }
        .logo img {
          height: 40px;
        }
        .company-tagline {
          color: #36454F;
          font-size: 14px;
          margin-top: 5px;
        }
        .email-body {
          padding: 30px;
          color: #36454F;
          line-height: 1.6;
        }
        .greeting {
          font-size: 22px;
          margin-bottom: 20px;
          color: #008080;
          text-align: center;
        }
        .summary {
          margin: 20px 0;
          background-color: #F8F8F8;
          padding: 15px;
          border-radius: 5px;
          font-size: 14px;
        }
        .summary p {
          margin: 8px 0;
        }
        .highlight {
          color: #008080;
          font-weight: bold;
        }
        .download-button {
          display: block;
          width: 250px;
          margin: 30px auto;
          padding: 14px 0;
          background-color: #008080;
          color: white;
          text-align: center;
          text-decoration: none;
          font-weight: bold;
          border-radius: 5px;
        }
        .download-button:hover {
          background-color: #5F9EA0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: #666;
          background-color: #F8F8F8;
          border-top: 1px solid #C0C0C0;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <div class="logo">
            <img src="https://i.ibb.co/N6xw569R/Logo-Bg-Removed-Fixed.png" alt="Khor Logo" />
          </div>
          <div class="company-tagline">Realize Your Utopia</div>
        </div>

        <div class="email-body">
          <h2 class="greeting">Your Booking is Confirmed!</h2>
          <p>Dear <span class="highlight">${customerName}</span>,</p>
          <p>Thank you for booking with Khor. Here's a quick summary of your booking:</p>

          <div class="summary">
            <p><strong>Property:</strong> ${propertyName}</p>
            ${roomName ? `<p><strong>Room:</strong> ${roomName}</p>` : ""}
            ${
              bookingInfo.packageName
                ? `<p><strong>Package:</strong> ${bookingInfo.packageName}</p>`
                : ""
            }
            ${
              locality || city
                ? `<p><strong>Location:</strong> ${locality}${
                    locality && city ? ", " : ""
                  }${city}</p>`
                : ""
            }
            <p><strong>Check-in:</strong> ${checkInDate}</p>
            <p><strong>Check-out:</strong> ${checkOutDate}</p>
            ${
              bookingInfo.guests
                ? `<p><strong>Guests:</strong> ${bookingInfo.guests}</p>`
                : ""
            }
            <p><strong>Total Price:</strong> <span class="highlight">PKR ${totalPrice}</span></p>
            <p><strong>Status:</strong> ${
              bookingInfo.bookingStatus || "Confirmed"
            }</p>
          </div>

          <p>A detailed invoice and booking information is available in the attached PDF.</p>

          ${
            vendorEmail || vendorPhone
              ? `
          <p>If you have any questions, feel free to contact your vendor at 
            ${
              vendorEmail ? `<span class="highlight">${vendorEmail}</span>` : ""
            }
            ${vendorEmail && vendorPhone ? "or call " : ""}
            ${
              vendorPhone ? `<span class="highlight">${vendorPhone}</span>` : ""
            }.
          </p>
          `
              : ""
          }
        </div>

        <div class="footer">
          <p>© 2025 <a href="https://www.gokhor.com" style="color:#008080; text-decoration:none; font-weight:bold;">Khor</a>. All rights reserved.</p>
          <p>Contact us: <a href="mailto:support@khor.com" style="color:#008080;">support@gokhor.com</a> | (555) 123-4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
