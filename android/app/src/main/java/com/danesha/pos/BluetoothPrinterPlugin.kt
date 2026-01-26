package com.danesha.pos

import com.danesha.pos.printer.PrinterService
import com.danesha.pos.printer.ReceiptData
import com.danesha.pos.printer.ReceiptItem
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat

import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "BluetoothPrinter")
class BluetoothPrinterPlugin : Plugin() {

    // Duplicate Print Protection (Lock)
    private val isPrinting = AtomicBoolean(false)
    private val PREFS_NAME = "BluetoothPrinterPrefs"
    private val KEY_LAST_TXN = "last_printed_txn"

    @PluginMethod
    fun scan(call: PluginCall) {
        if (!checkBluetoothPermissions()) {
            call.reject("Permission denied: Bluetooth access required")
            return
        }

        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null) {
            call.reject("Bluetooth not supported")
            return
        }

        if (!adapter.isEnabled) {
            call.reject("Bluetooth is disabled")
            return
        }

        // Return bonded (paired) devices
        // Scanning for new devices is slow and complex, usually users pair in Settings first.
        val bondedDevices = adapter.bondedDevices
        val devices = JSArray()
        
        for (device in bondedDevices) {
            val deviceObj = JSObject()
            deviceObj.put("name", device.name ?: "Unknown")
            deviceObj.put("address", device.address)
            deviceObj.put("id", device.address)
            devices.put(deviceObj)
        }
        
        val ret = JSObject()
        ret.put("devices", devices)
        call.resolve(ret)
    }

    private fun checkBluetoothPermissions(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED &&
                   ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        }
        return ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH) == PackageManager.PERMISSION_GRANTED
    }

    @PluginMethod
    fun print(call: PluginCall) {
        val macAddress = call.getString("macAddress")
        val data = call.getObject("data")

        if (macAddress == null) {
            val ret = JSObject()
            ret.put("status", "FAILED")
            ret.put("message", "MAC Address is required")
            ret.put("printerConnected", false)
            ret.put("canRetry", false) // User error, no need to retry
            call.resolve(ret)
            return
        }

        if (data == null) {
            val ret = JSObject()
            ret.put("status", "FAILED")
            ret.put("message", "Receipt Data is required")
            ret.put("printerConnected", false)
            ret.put("canRetry", false) // User error
            call.resolve(ret)
            return
        }
        
        // 1. Idempotency Check (Enterprise Feature)
        // Prevent duplicate printing of the same transaction ID
        val transactionId = data.getString("transactionId")
        if (!transactionId.isNullOrEmpty()) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastTxn = prefs.getString(KEY_LAST_TXN, "")
            if (lastTxn == transactionId) {
                val ret = JSObject()
                ret.put("status", "BUSY") // Using BUSY as per instruction to indicate "already done/skipped"
                ret.put("message", "Struk sudah dicetak sebelumnya (Idempotency Guard)")
                ret.put("printerConnected", true)
                ret.put("canRetry", false) // Idempotency: Do NOT retry
                call.resolve(ret)
                return
            }
        }
        
        // Check Lock
        if (!isPrinting.compareAndSet(false, true)) {
             val ret = JSObject()
             ret.put("status", "BUSY")
             ret.put("message", "Printer sedang digunakan")
             ret.put("printerConnected", true)
             ret.put("canRetry", true) // Just busy, can retry manually
             call.resolve(ret)
             return
        }

        // Parse Data
        try {
            val receiptData = parseReceiptData(data)
            
            // Run in background
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val stats = PrinterService.printReceipt(context, macAddress, receiptData)
                    
                    // Save Transaction ID on Success
                    if (!transactionId.isNullOrEmpty()) {
                        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        prefs.edit().putString(KEY_LAST_TXN, transactionId).apply()
                    }
                    
                    val ret = JSObject()
                    ret.put("status", "SUCCESS")
                    ret.put("message", "Print berhasil")
                    ret.put("printerConnected", true)
                    ret.put("canRetry", false)
                    
                    val telemetry = JSObject()
                    telemetry.put("connectTime", stats.connectTimeMs)
                    telemetry.put("printTime", stats.printTimeMs)
                    telemetry.put("bytes", stats.totalBytes)
                    ret.put("telemetry", telemetry)
                    
                    bridge.executeOnMainThread {
                        call.resolve(ret)
                    }
                } catch (e: Exception) {
                    val ret = JSObject()
                    ret.put("status", "FAILED")
                    ret.put("message", e.message ?: "Unknown error")
                    ret.put("printerConnected", false)
                    ret.put("canRetry", true) // Failed connection/timeout, can retry
                    
                    bridge.executeOnMainThread {
                        call.resolve(ret)
                    }
                } finally {
                    // Release Lock
                    isPrinting.set(false)
                }
            }
        } catch (e: Exception) {
            isPrinting.set(false) // Ensure lock is released if parse fails
            val ret = JSObject()
            ret.put("status", "FAILED")
            ret.put("message", "Invalid data format: ${e.message}")
            ret.put("printerConnected", false)
            ret.put("canRetry", false) // Data error
            call.resolve(ret)
        }
    }

    private fun parseReceiptData(json: JSObject): ReceiptData {
        val storeName = json.optString("storeName", "Store")
        val storeAddress = json.optString("storeAddress", "")
        val storePhone = json.optString("storePhone", "")
        val transactionId = json.optString("transactionId", "")
        val date = json.optString("date", "")
        val cashierName = json.optString("cashierName", "")
        
        val memberName = json.optString("memberName", "Guest")
        val memberStatus = json.optString("memberStatus", "")

        val subtotal = json.optDouble("subtotal", 0.0)
        val memberDiscountTotal = json.optDouble("memberDiscountTotal", 0.0)
        val promoDiscountTotal = json.optDouble("promoDiscountTotal", 0.0)
        val tax = json.optDouble("tax", 0.0)
        val total = json.optDouble("total", 0.0)
        
        val paymentMethod = json.optString("paymentMethod", "")
        val paidAmount = json.optDouble("paidAmount", 0.0)
        val changeAmount = json.optDouble("changeAmount", 0.0)
        
        val footerMessage = json.optString("footerMessage", "")
        
        val itemsJson = json.optJSONArray("items") ?: org.json.JSONArray()
        val items = ArrayList<ReceiptItem>()
        
        for (i in 0 until itemsJson.length()) {
            val itemJson = itemsJson.getJSONObject(i)
            items.add(
                ReceiptItem(
                    name = itemJson.optString("name", "Item"),
                    quantity = itemJson.optInt("quantity", 1),
                    price = itemJson.optDouble("price", 0.0),
                    grossTotal = itemJson.optDouble("grossTotal", 0.0),
                    memberDiscount = itemJson.optDouble("memberDiscount", 0.0),
                    promoDiscount = itemJson.optDouble("promoDiscount", 0.0),
                    total = itemJson.optDouble("total", 0.0),
                    discountReason = itemJson.optString("discountReason", null)
                )
            )
        }

        return ReceiptData(
            storeName, storeAddress, storePhone, transactionId, date, cashierName,
            memberName, memberStatus,
            items, 
            subtotal, memberDiscountTotal, promoDiscountTotal, tax, total,
            paymentMethod, paidAmount, changeAmount,
            footerMessage
        )
    }
}