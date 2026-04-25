export function accountActivationTemplate(
    name: string,
    activationLink: string,
    callBackUrl: string
) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Khor Account Activation</title>
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
                color: #F8F8F8;
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
            
            .activation-button {
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
                transition: background-color 0.3s;
            }
            
            .activation-button:hover {
                background-color: #5F9EA0;
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
            
            .contact-info {
                margin-top: 10px;
            }
            
            .website-link {
                color: #008080;
                text-decoration: none;
                font-weight: bold;
            }
            
            .website-link:hover {
                color: #5F9EA0;
                text-decoration: underline;
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
            
            @media (max-width: 600px) {
                .email-container {
                    border-radius: 0;
                }
                
                .email-body {
                    padding: 20px;
                }
                
                .activation-button {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <div class="email-body">
                <h2 class="greeting">Welcome, ${name}!</h2>
                
                <p class="message">Thank you for creating an account with Khor. We're excited to have you on board!</p>
                
                <p class="message">To get started, please activate your account by clicking the button below:</p>
                
                <a href="${callBackUrl + `?token=` + activationLink}" class="activation-button">ACTIVATE YOUR ACCOUNT</a>
                
                <div class="expiry-notice">
                    <p>This activation link will expire in 24 hours</p>
                </div>
                
                <div class="divider"></div>
                
                <p class="message">If you have trouble clicking the button, copy and paste the following URL into your browser:</p>
                
                <p class="message" style="word-break: break-all; color: #008080; background-color: #F8F8F8; padding: 10px; border-radius: 5px;">
                    ${callBackUrl + `?token=` + activationLink}
                </p>
                
                <p class="message">If you did not create an account with Khor, please ignore this email.</p>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} <a href="https://www.gokhor.com" class="website-link">Khor</a>. All rights reserved.</p>
                <p class="contact-info">Contact us: <a href="mailto:info@gokhor.com" class="website-link">info@gokhor.com</a></p>
                
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
// <a href="https://twitter.com/khor" class="social-icon">t</a>
