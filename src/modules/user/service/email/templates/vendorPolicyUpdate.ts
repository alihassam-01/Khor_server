import { renderKhorEmailShell } from "./_theme";

export type VendorPolicyUpdateTemplateInput = {
    recipientName?: string | null;
    title: string;
    content: string;
    partnerPortalUrl: string;
};

export function vendorPolicyUpdateTemplate(input: VendorPolicyUpdateTemplateInput): string {
    const content = `
        <div class="panel" style="white-space: pre-wrap;">${input.content}</div>
        <div class="panel">
            <p class="detail-row">
                <a href="${input.partnerPortalUrl}" class="website-link">Open Partner Portal</a>
            </p>
        </div>
    `;

    return renderKhorEmailShell({
        title: "Vendor policy updated",
        heading: "Vendor policy updated",
        greeting: `Hi ${input.recipientName || "there"},`,
        intro: "We updated the Khor partner vendor policy. This email includes a copy of the latest policy for your records.",
        content,
        // outro: "Your existing partner access and accepted status stay unchanged.",
    });
}
