export enum PackageStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    BLOCKED = 'blocked',
    UNVERIFIED = 'unverified',
    DISCONTINUED = 'discontinued',
  }
  
  export enum ReviewStatus {
    NOT_REVIEWED = 'notReviewed',
    PUBLISHED = 'published',
    REJECTED = 'rejected',
  }
  
  export enum MealType {
    BREAKFAST = 'Breakfast',
    LUNCH = 'Lunch',
    DINNER = 'Dinner',
    SNACKS = 'Snacks',
  }
  
  export enum PropertyType {
    CAR = 'Car',
    HOTEL = 'Hotel',
    OTHER = 'Other',
  }
  
  export enum RelatedType {
    ARTICLE = "article",
    TRAVEL_AGENCY = "travel_agency",
    ROOM = "room",
    HOTEL = "hotel",
    CAR_RENTAL = "car_rental",
  }
  
  export enum UserType {
    CUSTOMER = 'customer',
    TRAVEL_AGENCY = 'travel_agency'
  }
  
  export enum BusinessType {
    TRAVEL_AGENCY = 'travel_agency',
    HOTEL = 'hotel'
  }
  
  export enum BusinessStatus {
    RUNNING = 'running',
    PAUSED = 'paused'
  }
  