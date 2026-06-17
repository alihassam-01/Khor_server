import { renderKhorEmailShell } from "./_theme";

export type PartnerApprovalTemplateInput = {
    recipientName?: string | null;
    businessName?: string | null;
    approvedCapabilities: string[];
    partnerPortalUrl: string;
};

const formatCapability = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function partnerApprovalTemplate(input: PartnerApprovalTemplateInput): string {
    const capabilityList = input.approvedCapabilities.length > 0
        ? input.approvedCapabilities.map((capability) => `<li>${formatCapability(capability)}</li>`).join("")
        : "<li>Partner access</li>";

    const content = `
        <div class="panel">
            <p class="detail-row"><strong>Business:</strong> ${input.businessName || "Your business"}</p>
            <p class="detail-row"><strong>Access enabled:</strong></p>
            <ul class="list">
                ${capabilityList}
            </ul>
        </div>
        <div class="panel">
            <p class="detail-row">You can now sign in to the partner portal and start managing your business.</p>
            <p class="detail-row">
                <a href="${input.partnerPortalUrl}" class="website-link">Open Partner Portal</a>
            </p>
        </div>
    `;

    return renderKhorEmailShell({
        title: "Partner account approved",
        heading: "Your partner account is approved",
        greeting: `Hi ${input.recipientName || "there"},`,
        intro: "Your onboarding review is complete and your partner access is now live.",
        content,
        outro: "Thank you for partnering with Khor.",
    });
}
