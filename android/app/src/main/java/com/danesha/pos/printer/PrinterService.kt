package com.danesha.pos.printer

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.delay
import java.io.IOException
import java.util.UUID
import kotlin.jvm.JvmStatic

/**
 * Service to handle Bluetooth ESC/POS printing.
 * Follows the Singleton pattern for easy access.
 */
object PrinterService {
    private const val TAG = "PrinterService"
    // Standard Serial Port Profile (SPP) UUID
    private val SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    
    // Debug Flag (Toggle via code or remote config later)
    private const val DEBUG = true // Hardcoded for now to fix build issues

    // Telemetry Data Class
    data class PrintStats(
        val connectTimeMs: Long,
        val printTimeMs: Long,
        val totalBytes: Int
    )

    /**
     * Print a receipt using the provided MAC address and data.
     * This function is suspending and handles timeouts.
     *
     * @param context Context for permission checks
     * @param macAddress Bluetooth MAC address of the printer
     * @param data Structured receipt data
     * @return PrintStats telemetry data on success
     * @throws Exception if printing fails after retries or times out
     */
    suspend fun printReceipt(context: Context, macAddress: String, data: ReceiptData): PrintStats {
        verifyPermissions(context)

        // Soft Timeout: 15 seconds max for the entire operation
        try {
            return withTimeout(15000L) {
                var attempts = 0
                val maxRetries = 1 // Retry 1 time (total 2 attempts)
                var lastException: Exception? = null
                val startTime = System.currentTimeMillis()

                while (attempts <= maxRetries) {
                    try {
                        if (DEBUG) Log.d(TAG, "Print attempt ${attempts + 1} for $macAddress")
                        val stats = executePrint(context, macAddress, data)
                        if (DEBUG) Log.d(TAG, "Print success in ${System.currentTimeMillis() - startTime}ms")
                        return@withTimeout stats // Success
                    } catch (e: Exception) {
                        if (DEBUG) Log.e(TAG, "Print failed on attempt ${attempts + 1}: ${e.message}")
                        lastException = e
                        attempts++
                        if (attempts <= maxRetries) {
                            delay(1000) // Wait before retry (suspend friendly)
                        }
                    }
                }
                // Rethrow last exception if all retries failed
                throw lastException ?: IOException("Unknown print error")
            }
        } catch (e: kotlinx.coroutines.TimeoutCancellationException) {
            throw IOException("Printer timeout (15s). Cek koneksi printer.", e)
        } catch (e: Exception) {
             // Rethrow with user-friendly message
             throw IOException(humanizeError(e), e)
        }
    }

    private fun humanizeError(e: Exception?): String {
        val msg = e?.message.orEmpty().lowercase()
        return when {
            "connect" in msg || "timeout" in msg ->
                "Printer tidak merespons. Pastikan printer menyala dan dekat."
            "disabled" in msg ->
                "Bluetooth mati. Silakan nyalakan Bluetooth."
            "permission" in msg ->
                "Izin Bluetooth belum diberikan."
            else ->
                "Gagal mencetak. Silakan coba ulang."
        }
    }

    /**
     * Internal function to execute the print job.
     */
    @SuppressLint("MissingPermission") // Permissions are verified in verifyPermissions
    private fun executePrint(context: Context, macAddress: String, data: ReceiptData): PrintStats {
        val adapter = BluetoothAdapter.getDefaultAdapter()
            ?: throw IOException("Bluetooth tidak didukung di device ini")

        if (!adapter.isEnabled) {
            throw IOException("Bluetooth is disabled")
        }

        val device = try {
            adapter.getRemoteDevice(macAddress)
        } catch (e: IllegalArgumentException) {
            throw IOException("Format MAC Address salah: $macAddress")
        }

        var socket: BluetoothSocket? = null
        val startTotalTime = System.currentTimeMillis()
        var connectDuration = 0L

        try {
            // Create RFCOMM socket
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            
            // Connect (Blocking call)
            if (DEBUG) Log.d(TAG, "Connecting to socket...")
            
            val startConnect = System.currentTimeMillis()
            socket.connect()
            connectDuration = System.currentTimeMillis() - startConnect

            if (!socket.isConnected) {
                throw IOException("Socket gagal terkoneksi (Closed)")
            }

            val outputStream = socket.outputStream
            
            // Generate ESC/POS commands
            val bytes = generateReceiptBytes(data)
            
            if (DEBUG) Log.d(TAG, "Sending ${bytes.size} bytes to printer")
            
            // Write data
            outputStream.write(bytes)
            outputStream.flush()
            
            // Small delay to ensure printer buffer receives data before closing
            Thread.sleep(500) 
            
            val totalDuration = System.currentTimeMillis() - startTotalTime
            return PrintStats(connectDuration, totalDuration, bytes.size)

        } catch (e: IOException) {
            // Close socket if connection failed
            try {
                socket?.close()
            } catch (closeEx: Exception) {
                // Ignore
            }
            // Enhance error message for debugging
            throw IOException("Connection failed: ${e.message}", e)
        } finally {
            // Always close socket
            try {
                socket?.close()
            } catch (e: IOException) {
                Log.w(TAG, "Error closing socket", e)
            }
        }
    }

    private fun generateReceiptBytes(data: ReceiptData): ByteArray {
        val builder = EscPosBuilder()
        
        // Header
        builder.init()
            .setAlign(EscPosBuilder.Align.CENTER)
            .setBold(true)
            .setSize(EscPosBuilder.Size.BIG) // Large Store Name
            .textLine(data.storeName)
            .setSize(EscPosBuilder.Size.NORMAL) // Reset
            .setBold(false)
            .textLine(data.storeAddress)
            
        if (data.storePhone.isNotEmpty()) {
            builder.textLine("Tel: ${data.storePhone}")
        }
            
        builder.feed(1)
            
        // Info
        builder.setAlign(EscPosBuilder.Align.LEFT)
            .textLine("Date: ${data.date}")
            .textLine("Trans: ${data.transactionId}")
            .textLine("Cashier: ${data.cashierName}")
            
        // Member Info
        if (data.memberName.isNotEmpty() && data.memberName != "Guest") {
            builder.textLine("Member: ${data.memberName}")
            if (data.memberStatus.isNotEmpty()) {
                builder.textLine("Kategori: ${data.memberStatus}")
            }
        }
        
        builder.separator() // Default 32 chars
            
        // Items
        for (item in data.items) {
            // Truncate item name to 30 chars
            builder.textTruncated(item.name, 30) 
            
            val line = "${item.quantity} x ${formatPrice(item.price)} = ${formatPrice(item.total)}"
            builder.textLine(line)
            
            // Item Discount
            if (item.discountAmount > 0) {
                val discText = if (item.discountType == "PERCENT") {
                    "Disc (${String.format("%.0f", item.discountPercent)}%): -${formatPrice(item.discountAmount)}"
                } else {
                    "Disc: -${formatPrice(item.discountAmount)}"
                }
                builder.textLine(discText)
            }
        }
        
        builder.separator()
        
        // Totals
        builder.setAlign(EscPosBuilder.Align.RIGHT)
            .setBold(true)
            .textLine("Subtotal: ${formatPrice(data.subtotal)}")
            
        if (data.discountTotal > 0) {
            builder.textLine("Discount: -${formatPrice(data.discountTotal)}")
        }
        
        builder.textLine("Tax: ${formatPrice(data.tax)}")
        builder.setSize(EscPosBuilder.Size.DOUBLE_HEIGHT) // Make TOTAL stand out
        builder.textLine("TOTAL: ${formatPrice(data.total)}")
        builder.setSize(EscPosBuilder.Size.NORMAL)
        
        // Payment Info
        builder.feed(1)
        if (data.paymentMethod.isNotEmpty()) {
             builder.textLine("Payment: ${data.paymentMethod}")
        }
        if (data.paidAmount > 0) {
            builder.textLine("Paid: ${formatPrice(data.paidAmount)}")
        }
        builder.textLine("Change: ${formatPrice(data.changeAmount)}")

        builder.setBold(false)
            
        // Footer
        builder.feed(1)
            .setAlign(EscPosBuilder.Align.CENTER)
            .setFont(EscPosBuilder.Font.B) // Small font for footer
            .textLine(data.footerMessage)
            .setFont(EscPosBuilder.Font.A) // Reset
            .feed(3)
            .cut()
            
        return builder.getBytes()
    }
    
    private fun formatPrice(price: Double): String {
        return String.format("%,.0f", price) // No decimals for IDR usually
    }

    private fun verifyPermissions(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                throw SecurityException("Permission BLUETOOTH_CONNECT not granted")
            }
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                // Scan might be needed for discovery, but for direct connect usually CONNECT is enough
                // However, good to have.
                // throw SecurityException("Permission BLUETOOTH_SCAN not granted")
            }
        } else {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) != PackageManager.PERMISSION_GRANTED) {
                throw SecurityException("Permission BLUETOOTH not granted")
            }
        }
    }
}
