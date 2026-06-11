export enum BusinessOnboardingStatus {
    DRAFT = "draft",
    SUBMITTED = "submitted",
    CHANGES_REQUESTED = "changes_requested",
    APPROVED = "approved",
    REJECTED = "rejected",
    SUSPENDED = "suspended",
}

export enum BusinessCapabilityType {
    HOTEL = "hotel",
    RESTAURANT = "restaurant",
    TOUR = "tour",
    VEHICLE = "vehicle",
}

export enum BusinessCapabilityStatus {
    DRAFT = "draft",
    SUBMITTED = "submitted",
    APPROVED = "approved",
    REJECTED = "rejected",
    SUSPENDED = "suspended",
}

export enum BusinessDocumentType {
    CNIC_FRONT = "cnic_front",
    CNIC_BACK = "cnic_back",
    OWNERSHIP_PROOF = "ownership_proof",
    LEASE_AGREEMENT = "lease_agreement",
    BUSINESS_LICENSE = "business_license",
}

export enum BusinessDocumentStatus {
    PENDING_UPLOAD = "pending_upload",
    UPLOADED = "uploaded",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    SUPERSEDED = "superseded",
}

export enum PartnerAccessStatus {
    ADMIN = "admin",
    CUSTOMER = "customer",
    DRAFT = "draft",
    SUBMITTED = "submitted",
    CHANGES_REQUESTED = "changes_requested",
    APPROVED = "approved",
    REJECTED = "rejected",
    SUSPENDED = "suspended",
    LEGACY_VENDOR = "legacy_vendor",
}
