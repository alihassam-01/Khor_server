export const analyticsReportTemplate = (vendorName: string, reportPeriod: string, adsStats: any[]) => {
    const tableRows = adsStats.map(ad => `
        <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px 0;">
                <div style="font-weight: bold; color: #2d3748;">${ad.name}</div>
                <div style="font-size: 12px; color: #718096;">${ad.type}</div>
            </td>
            <td style="padding: 12px 0; text-align: center; color: #2d3748;">${ad.views}</td>
            <td style="padding: 12px 0; text-align: center; color: #2d3748;">${ad.clicks}</td>
            <td style="padding: 12px 0; text-align: center; color: #2d3748;">${ad.unique_visitors}</td>
            <td style="padding: 12px 0; text-align: center;">
                <span style="color: #38a169; font-weight: bold;">${ad.ctr}%</span>
            </td>
        </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #4a5568; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; }
            .header { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #008080; }
            .content { padding: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #a0aec0; padding-top: 20px; border-top: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; padding: 12px 0; border-bottom: 2px solid #edf2f7; color: #718096; text-transform: uppercase; font-size: 12px; }
            .stat-card { background: #f7fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="color: #008080; margin: 0;">Performance Report</h1>
                <p style="margin: 5px 0; color: #718096;">${reportPeriod}</p>
            </div>
            <div class="content">
                <p>Hello <strong>${vendorName}</strong>,</p>
                <p>Here is your advertisement performance report for the past ${reportPeriod.toLowerCase().includes('weekly') ? 'week' : 'month'}.</p>
                
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">Advertisement</th>
                            <th style="text-align: center;">Views</th>
                            <th style="text-align: center;">Clicks</th>
                            <th style="text-align: center;">Unique</th>
                            <th style="text-align: center;">CTR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
                
                <p style="margin-top: 30px;">Keep your ads active and featured to reach more travelers in Baltistan!</p>
            </div>
            <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Travel Baltistan (Khor). All rights reserved.</p>
                <p>You received this because you are a registered vendor on our platform.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};
