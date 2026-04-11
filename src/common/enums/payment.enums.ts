export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}

export enum PaymentMethod {
    CASH = 'cash',
    BANK_TRANSFER = 'bank_transfer',
    EASYPAISA = 'easypaisa',
    JAZZCASH = 'jazzcash',
    CREDIT_CARD = 'credit_card',
    DEBIT_CARD = 'debit_card',
}
