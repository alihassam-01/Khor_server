export function adActivationTemplate(
    vendorName: string,
    adName: string,
    adType: string,
    expiryDate: string
) {
    const isHotel = adType.toLowerCase() === "hotel";
    const itemLabel = isHotel ? "hotel" : "listing";
    const titleLabel = isHotel ? "Hotel Activated" : "Listing Activated";
    const manageLabel = isHotel ? "your hotel" : "your listing";

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${titleLabel} - Khor</title>
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
            
            .logo-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 15px;
            }
            
            .logo {
                font-size: 36px;
                font-weight: bold;
                color: #36454F;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .logo-icon {
                margin-right: 10px;
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
            
            .message {
                margin-bottom: 25px;
                font-size: 16px;
                text-align: center;
            }
            
            .summary-box {
                background-color: #F8F8F8;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 25px;
                border-left: 4px solid #008080;
            }
            
            .summary-item {
                margin-bottom: 10px;
                font-size: 15px;
            }
            
            .summary-label {
                font-weight: bold;
                color: #666;
            }
            
            .action-button {
                display: block;
                width: 250px;
                margin: 30px auto;
                padding: 14px 0;
                background-color: #008080;
                color: white !important;
                text-align: center;
                text-decoration: none;
                font-weight: bold;
                border-radius: 5px;
            }
            
            .divider {
                height: 1px;
                background-color: #C0C0C0;
                margin: 25px 0;
            }
            
            .footer {
                text-align: center;
                padding: 20px;
                font-size: 12px;
                color: #666;
                background-color: #F8F8F8;
                border-top: 1px solid #C0C0C0;
            }
            
            .website-link {
                color: #008080;
                text-decoration: none;
                font-weight: bold;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-icon {
                display: inline-block;
                width: 32px;
                height: 32px;
                background-color: #36454F;
                color: white !important;
                border-radius: 50%;
                line-height: 32px;
                text-align: center;
                margin: 0 5px;
                text-decoration: none;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-body">
                <h2 class="greeting">Great news, ${vendorName}!</h2>
                
                <p class="message">Your ${adType} ${itemLabel} "<strong>${adName}</strong>" has been activated successfully.</p>
                
                <p class="message">Your ${itemLabel} is now live and visible to travelers on the Khor platform.</p>
                
                <div class="summary-box">
                    <div class="summary-item">
                        <span class="summary-label">Listing:</span> ${adName}
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Type:</span> ${adType}
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Status:</span> <span style="color: #008000; font-weight: bold;">Active</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Expires At:</span> ${expiryDate}
                    </div>
                </div>
                
                <p class="message">You can manage ${manageLabel} and view performance analytics from your vendor dashboard.</p>
                
                <a href="https://gokhor.com/owner-dashboard" class="action-button">GO TO DASHBOARD</a>
                
                <div class="divider"></div>
                
                <p class="message" style="font-size: 14px; color: #666;">
                    Thank you for partnering with Khor. We are committed to helping your business grow.
                </p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} <a href="https://www.gokhor.com" class="website-link">Khor</a>. All rights reserved.</p>
                <p>Contact us: <a href="mailto:info@gokhor.com" class="website-link">info@gokhor.com</a></p>
                
                <div class="social-links">
                    <a href="https://web.facebook.com/people/GoKhor/61586037316500/" class="social-icon">f</a>
                    <a href="https://www.linkedin.com/company/gokhor" class="social-icon">in</a>
                    <a href="https://www.instagram.com/khor.explore" class="social-icon">ig</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}
