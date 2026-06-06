type KhorEmailShellInput = {
    title: string;
    heading: string;
    greeting?: string | null;
    intro?: string | null;
    content: string;
    outro?: string | null;
};

export function renderKhorEmailShell(input: KhorEmailShellInput): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${input.title}</title>
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
                max-width: 640px;
                width: 100%;
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

            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #36454F;
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

            .heading {
                font-size: 24px;
                margin-bottom: 16px;
                color: #008080;
            }

            .greeting,
            .intro,
            .outro {
                font-size: 16px;
                margin-bottom: 16px;
            }

            .panel {
                border: 1px solid #D7E3E3;
                border-radius: 12px;
                padding: 18px;
                margin: 18px 0;
                background-color: #FAFEFE;
            }

            .detail-row {
                margin-bottom: 8px;
            }

            .detail-row:last-child {
                margin-bottom: 0;
            }

            .muted {
                color: #667085;
            }

            .list {
                margin: 0;
                padding-left: 18px;
            }

            .list li {
                margin-bottom: 8px;
            }

            .table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 12px;
            }

            .table th,
            .table td {
                text-align: left;
                padding: 10px 8px;
                border-bottom: 1px solid #E7EEEE;
                vertical-align: top;
                font-size: 14px;
            }

            .table th {
                color: #667085;
                font-weight: 700;
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
                <div class="logo">Khor</div>
                <p class="company-tagline">Explore with confidence</p>
            </div>

            <div class="email-body">
                <h1 class="heading">${input.heading}</h1>
                ${input.greeting ? `<p class="greeting">${input.greeting}</p>` : ""}
                ${input.intro ? `<p class="intro">${input.intro}</p>` : ""}
                ${input.content}
                ${input.outro ? `<p class="outro">${input.outro}</p>` : ""}
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
