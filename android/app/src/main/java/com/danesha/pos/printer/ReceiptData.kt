package com.danesha.pos.printer

/**
 * Data model for receipt information.
 * This structure is used to pass data from the Plugin/UI to the PrinterService.
 */
data class ReceiptData(
    val storeName: String,
    val storeAddress: String,
    val storePhone: String = "",
    val transactionId: String,
    val date: String,
    val cashierName: String,
    
    // Member Info
    val memberName: String,
    val memberStatus: String,

    val items: List<ReceiptItem>,
    
    val subtotal: Double, // Gross Total (Qty * Price)
    val memberDiscountTotal: Double,
    val promoDiscountTotal: Double,
    val tax: Double,
    val total: Double, // Net Total
    
    // Payment
    val paymentMethod: String,
    val paidAmount: Double,
    val changeAmount: Double,
    
    val footerMessage: String
)

data class ReceiptItem(
    val name: String,
    val quantity: Int,
    val price: Double,
    val grossTotal: Double, // Qty * Price
    val memberDiscount: Double,
    val promoDiscount: Double,
    val total: Double, // Net Total
    val discountReason: String? = null
)