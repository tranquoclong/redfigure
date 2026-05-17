export function isOwnerEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    if (!normalized) return false;

    const ownerList = (process.env.OWNER_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);
    if (ownerList.length === 0) return false;

    return ownerList.includes(normalized);
}