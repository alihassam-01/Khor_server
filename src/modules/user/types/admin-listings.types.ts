export type IAdminListingDto = {
    id: string;
    type: string;
    name: string;
    status: string;
    isActive: boolean;
    isFeatured: boolean;
    isPublicVisible: boolean;
    visibilityNote: string | null;
    locationName: string | null;
    vendorName: string | null;
    createdAt: string;
    updatedAt: string;
};

export type IUpdateListingVisibilityDto = {
    is_public_visible: boolean;
    visibility_note?: string | null;
};
