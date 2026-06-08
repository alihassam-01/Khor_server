export function normalizePhoneToE164(
    input: string | null | undefined,
    defaultCountryCode = "92",
): string | null {
    if (!input) return null;

    const trimmed = input.trim();
    if (!trimmed) return null;

    let digits = trimmed.replace(/[^\d+]/g, "");
    if (digits.startsWith("00")) {
        digits = `+${digits.slice(2)}`;
    }

    if (digits.startsWith("+")) {
        return /^\+[1-9]\d{6,14}$/.test(digits) ? digits : null;
    }

    digits = digits.replace(/\D/g, "");
    if (digits.startsWith("0")) {
        digits = `${defaultCountryCode}${digits.slice(1)}`;
    } else if (!digits.startsWith(defaultCountryCode)) {
        digits = `${defaultCountryCode}${digits}`;
    }

    const normalized = `+${digits}`;
    return /^\+[1-9]\d{6,14}$/.test(normalized) ? normalized : null;
}

