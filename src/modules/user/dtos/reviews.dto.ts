export interface CreateReviewDTO {
  userId: string;
  targetId: string;
  targetType: ReviewTargetType;
  reviewText: string;
  rating: number;
  customerId?: string;
}

export type ReviewTargetType = 'property' | 'room_type' | 'tour_package';
