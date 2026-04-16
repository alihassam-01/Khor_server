export function forgotPasswordTemplate(
    name: string,
    otpCode: string
) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Khor Password Reset</title>
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
                position: relative;
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
                color: #FFFFFF;
                display: flex;
                align-items: center;
            }
            .logo-icon {
                margin-right: 10px;
                font-size: 32px;
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
                color: #36454F;
            }
            .message {
                margin-bottom: 25px;
                font-size: 16px;
            }
            .otp-container {
                background-color: #F8F8F8;
                border-radius: 10px;
                padding: 30px;
                text-align: center;
                margin: 30px 0;
                border: 2px dashed #008080;
            }
            .otp-code {
                font-size: 42px;
                font-weight: bold;
                letter-spacing: 10px;
                color: #008080;
                font-family: 'Courier New', Courier, monospace;
            }
            .expiry-notice {
                text-align: center;
                font-size: 14px;
                color: #666;
                margin-top: 20px;
                padding: 12px;
                background-color: #F8F8F8;
                border-radius: 5px;
                border-left: 4px solid #C0C0C0;
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
                color: white;
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
            <div class="email-header">
                <div class="logo-container">
                    <div class="logo">
                        <span class="logo-icon">
                            <img src="https://i.ibb.co/N6xw569R/Logo-Bg-Removed-Fixed.png" alt="Khor Logo" style="height:32px;vertical-align:middle;" />
                        </span> KHOR
                    </div>
                </div>
                <div class="company-tagline">Realize Your Utopia</div>
            </div>
            <div class="email-body">
                <h2 class="greeting">Hello, ${name}!</h2>
                <p class="message">We received a request to reset your password for your Khor account.</p>
                <p class="message">Your password reset verification code is:</p>
                
                <div class="otp-container">
                    <div class="otp-code">${otpCode}</div>
                </div>

                <div class="expiry-notice">
                    <p>This verification code will expire in 10 minutes.</p>
                </div>
                <div class="divider"></div>
                <p class="message">If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} <a href="https://www.gokhor.com" class="website-link">Khor</a>. All rights reserved.</p>
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
