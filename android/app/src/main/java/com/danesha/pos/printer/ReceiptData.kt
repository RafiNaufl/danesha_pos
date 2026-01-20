package com.danesha.pos.printer

/**
 * Data model for receipt information.
 * This structure is used to pass data from the Plugin/UI to the PrinterService.
 */
data class ReceiptData(
    val storeName: String,
    val storeAddress: String,
    val transactionId: String,
    val date: String,
    val cashierName: String,
    val items: List<ReceiptItem>,
    val subtotal: Double,
    val tax: Double,
    val total: Double,
    val footerMessage: String
)

data class ReceiptItem(
    val name: String,
    val quantity: Int,
    val price: Double,
    val total: Double
)
