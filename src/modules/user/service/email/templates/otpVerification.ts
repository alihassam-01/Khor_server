export function otpVerificationTemplate(name: string, otp: string, expiryMinutes: number): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Khor Account Verification</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Arial', sans-serif; }
            body { background-color: #F3F4F6; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            .email-container { max-width: 600px; background-color: #FFFFFF; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .email-header { background-color: #F8F8F8; padding: 25px; text-align: center; }
            .logo-container { display: flex; justify-content: center; align-items: center; margin-bottom: 15px; }
            .logo { font-size: 36px; font-weight: bold; color: #36454F; display: flex; align-items: center; gap: 10px; }
            .company-tagline { color: #36454F; font-size: 14px; margin-top: 5px; }
            .email-body { padding: 30px; color: #36454F; line-height: 1.6; }
            .greeting { font-size: 22px; margin-bottom: 20px; color: #36454F; }
            .message { margin-bottom: 20px; font-size: 16px; }
            .otp-box { display: block; width: fit-content; margin: 30px auto; padding: 20px 40px; background-color: #F0FDFA; border: 2px solid #008080; border-radius: 10px; text-align: center; }
            .otp-label { font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
            .otp-code { font-size: 40px; font-weight: bold; color: #008080; letter-spacing: 12px; }
            .expiry-notice { text-align: center; font-size: 14px; color: #666; margin-top: 20px; padding: 12px; background-color: #F8F8F8; border-radius: 5px; border-left: 4px solid #C0C0C0; }
            .divider { height: 1px; background-color: #C0C0C0; margin: 25px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; background-color: #F8F8F8; border-top: 1px solid #C0C0C0; }
            .website-link { color: #008080; text-decoration: none; font-weight: bold; }
            .social-links { margin-top: 15px; }
            .social-icon { display: inline-block; width: 32px; height: 32px; background-color: #36454F; color: white; border-radius: 50%; line-height: 32px; text-align: center; margin: 0 5px; text-decoration: none; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-body">
                <h2 class="greeting">Welcome, ${name}!</h2>
                <p class="message">Thank you for signing up with Khor. Use the code below to verify your account.</p>

                <div class="otp-box">
                    <div class="otp-label">Your verification code</div>
                    <div class="otp-code">${otp}</div>
                </div>

                <div class="expiry-notice">
                    <p>This code expires in <strong>${expiryMinutes} minutes</strong>. Do not share it with anyone.</p>
                </div>

                <div class="divider"></div>

                <p class="message">If you did not create an account with Khor, please ignore this email.</p>
            </div>

            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} <a href="https://www.gokhor.com" class="website-link">Khor</a>. All rights reserved.</p>
                <p style="margin-top:8px;">Contact us: <a href="mailto:info@gokhor.com" class="website-link">info@gokhor.com</a></p>
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
