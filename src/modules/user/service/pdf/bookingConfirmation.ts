interface BookingConfirmationTemplateProps {
  booking_type: "tour" | "hotel";
  customerInfo: {
    fullName: string;
    email: string;
    phone: string;
    cnic: string;
    address: string;
    special_requests?: string;
  };
  propertyLocation: {
    locality: string | null;
    city: string | null;
    address?: {
      street_address: string;
      landmark: string;
      location: {
        name: string;
      };
    } | null;
  };
  roomName?: string;
  packageName?: string;
  check_in_date: string;
  check_out_date: string;
  participants_count: number;
  total_amount: number;
  payment_status: string;
  booking_status: string;
  // Optional fields with fallbacks
  roomDetails?: {
    maxOccupancy?: number;
    beds?: string;
  };
  amenities?: string[];
  vendorName?: string;
  vendorPhone?: string;
  vendorEmail?: string;
}

export function bookingConfirmationTemplate(
  bookingInfo: BookingConfirmationTemplateProps
) {
  // Safe data extraction with fallbacks
  const propertyName =
    bookingInfo.propertyLocation.address?.location?.name || "Unknown Property";
  const streetAddress =
    bookingInfo.propertyLocation.address?.street_address || "Not specified";
  const landmark =
    bookingInfo.propertyLocation.address?.landmark || "Not specified";
  const locality = bookingInfo.propertyLocation.locality || "Not specified";
  const city = bookingInfo.propertyLocation.city || "Not specified";
  const roomName = bookingInfo.roomName || "Not specified";
  const specialRequests = bookingInfo.customerInfo.special_requests || "None";

  const roomCapacity = bookingInfo.roomDetails?.maxOccupancy
    ? `${bookingInfo.roomDetails.maxOccupancy} (Beds: ${
        bookingInfo.roomDetails.beds || "Not specified"
      })`
    : "Not specified";

  const amenities = bookingInfo.amenities?.join(", ") || "None";

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
                max-width: 700px;
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

            .logo-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 10px;
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

            .section-title {
                font-size: 18px;
                font-weight: bold;
                margin: 20px 0 10px;
                color: #36454F;
                border-left: 4px solid #008080;
                padding-left: 10px;
            }

            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }

            .info-table th, .info-table td {
                padding: 10px;
                text-align: left;
                border-bottom: 1px solid #E5E7EB;
                font-size: 14px;
            }

            .info-table th {
                background-color: #f8f8f8;
                font-weight: bold;
            }

            .highlight {
                color: #008080;
                font-weight: bold;
            }

            .footer {
                text-align: center;
                padding: 20px;
                font-size: 12px;
                color: #666;
                background-color: #F8F8F8;
                border-top: 1px solid #C0C0C0;
            }

            /* Hide elements that might not be applicable */
            .conditional-hide {
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-header">
                <div class="logo-container">
                    <div class="logo">
                        <img src="https://i.ibb.co/N6xw569R/Logo-Bg-Removed-Fixed.png" alt="Khor Logo" />
                    </div>
                </div>
                <div class="company-tagline">Realize Your Utopia</div>
            </div>

            <div class="email-body">
                <h2 class="greeting">Booking Confirmation</h2>
                <p>Dear <span class="highlight">${
                  bookingInfo.customerInfo.fullName
                }</span>,</p>
                <p>We're excited to confirm your <strong>${
                  bookingInfo.booking_type
                }</strong> booking with Khor. Here are your booking details:</p>

                <!-- Property Details -->
                <h3 class="section-title">Property Information</h3>
                <table class="info-table">
                    <tr><th>Property</th><td>${propertyName}</td></tr>
                    ${
                      bookingInfo.booking_type === "hotel"
                        ? `<tr><th>Room</th><td>${roomName}</td></tr>`
                        : ""
                    }
                    ${
                      bookingInfo.booking_type === "tour" &&
                      bookingInfo.packageName
                        ? `<tr><th>Package</th><td>${bookingInfo.packageName}</td></tr>`
                        : ""
                    }
                    <tr><th>Location</th><td>${locality}, ${city}</td></tr>
                    <tr><th>Street Address</th><td>${streetAddress}</td></tr>
                    <tr><th>Landmark</th><td>${landmark}</td></tr>
                </table>

                <!-- Customer Details -->
                <h3 class="section-title">Guest Information</h3>
                <table class="info-table">
                    <tr><th>Name</th><td>${
                      bookingInfo.customerInfo.fullName
                    }</td></tr>
                    <tr><th>Email</th><td>${
                      bookingInfo.customerInfo.email
                    }</td></tr>
                    <tr><th>Phone</th><td>${
                      bookingInfo.customerInfo.phone
                    }</td></tr>
                    <tr><th>CNIC</th><td>${
                      bookingInfo.customerInfo.cnic
                    }</td></tr>
                    <tr><th>Address</th><td>${
                      bookingInfo.customerInfo.address
                    }</td></tr>
                    <tr><th>Special Requests</th><td>${specialRequests}</td></tr>
                </table>

                <!-- Booking Details -->
                <h3 class="section-title">Booking Details</h3>
                <table class="info-table">
                    <tr><th>Check-in</th><td>${new Date(
                      bookingInfo.check_in_date
                    ).toDateString()}</td></tr>
                    <tr><th>Check-out</th><td>${new Date(
                      bookingInfo.check_out_date
                    ).toDateString()}</td></tr>
                    <tr><th>Guests</th><td>${bookingInfo.participants_count}</td></tr>
                    ${
                      bookingInfo.booking_type === "hotel"
                        ? `<tr><th>Room Capacity</th><td>${roomCapacity}</td></tr>`
                        : ""
                    }
                    ${
                      bookingInfo.booking_type === "hotel"
                        ? `<tr><th>Amenities</th><td>${amenities}</td></tr>`
                        : ""
                    }
                    <tr><th>Total Price</th><td><span class="highlight">PKR ${bookingInfo.total_amount.toLocaleString()}</span></td></tr>
                    <tr><th>Payment Status</th><td>${
                      bookingInfo.payment_status
                    }</td></tr>
                    <tr><th>Booking Status</th><td>${
                      bookingInfo.booking_status
                    }</td></tr>
                </table>

                ${
                  bookingInfo.vendorName ||
                  bookingInfo.vendorPhone ||
                  bookingInfo.vendorEmail
                    ? `
                <!-- Vendor Details -->
                <h3 class="section-title">Vendor Information</h3>
                <table class="info-table">
                    ${
                      bookingInfo.vendorName
                        ? `<tr><th>Vendor Name</th><td>${bookingInfo.vendorName}</td></tr>`
                        : ""
                    }
                    ${
                      bookingInfo.vendorPhone
                        ? `<tr><th>Vendor Phone</th><td>${bookingInfo.vendorPhone}</td></tr>`
                        : ""
                    }
                    ${
                      bookingInfo.vendorEmail
                        ? `<tr><th>Vendor Email</th><td>${bookingInfo.vendorEmail}</td></tr>`
                        : ""
                    }
                </table>
                `
                    : ""
                }

                <p>We look forward to hosting you. If you have any questions, feel free to reach out to your vendor or our support team.</p>
            </div>

            <div class="footer">
                <p>© 2025 <a href="https://www.khor.com" style="color:#008080; text-decoration:none; font-weight:bold;">Khor</a>. All rights reserved.</p>
                <p>Contact us: <a href="mailto:support@khor.com" style="color:#008080;">support@khor.com</a> | (555) 123-4567</p>
            </div>
        </div>
    </body>
    </html>
  `;
}
