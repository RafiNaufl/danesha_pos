package com.danesha.pos.printer

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/**
 * Helper class to build ESC/POS commands.
 */
class EscPosBuilder {
    private val outputStream = ByteArrayOutputStream()
    
    // State tracking for auto-layout
    private var currentFont = Font.A
    private var currentSize = Size.NORMAL

    // Using generic charset, often printers default to CP437 or GBK.
    // Ensure your printer supports the charset used here.
    private val charset: Charset by lazy {
        try {
            Charset.forName("GBK")
        } catch (e: Exception) {
            Charset.defaultCharset()
        }
    }

    enum class Align {
        LEFT, CENTER, RIGHT
    }

    enum class Font {
        A, // Normal (12x24) - 32 chars usually
        B  // Small (9x17) - 42 chars usually
    }

    enum class Size {
        NORMAL,
        DOUBLE_HEIGHT,
        DOUBLE_WIDTH,
        BIG // Double Width + Double Height
    }

    /**
     * Initialize printer (clear buffer, reset modes)
     * ESC @
     */
    fun init(): EscPosBuilder {
        outputStream.write(byteArrayOf(0x1B, 0x40))
        return this
    }

    /**
     * Set text alignment
     * ESC a n
     */
    fun setAlign(align: Align): EscPosBuilder {
        val n = when (align) {
            Align.LEFT -> 0
            Align.CENTER -> 1
            Align.RIGHT -> 2
        }
        outputStream.write(byteArrayOf(0x1B, 0x61, n.toByte()))
        return this
    }

    /**
     * Set font type (A = Normal, B = Small)
     * ESC M n
     */
    fun setFont(font: Font): EscPosBuilder {
        this.currentFont = font
        val n = if (font == Font.A) 0 else 1
        outputStream.write(byteArrayOf(0x1B, 0x4D, n.toByte()))
        return this
    }

    /**
     * Set font size scale
     * GS ! n
     */
    fun setSize(size: Size): EscPosBuilder {
        this.currentSize = size
        val n = when (size) {
            Size.NORMAL -> 0x00
            Size.DOUBLE_HEIGHT -> 0x01
            Size.DOUBLE_WIDTH -> 0x10
            Size.BIG -> 0x11
        }
        outputStream.write(byteArrayOf(0x1D, 0x21, n.toByte()))
        return this
    }

    /**
     * Set bold mode
     * ESC E n
     */
    fun setBold(bold: Boolean): EscPosBuilder {
        val n = if (bold) 1 else 0
        outputStream.write(byteArrayOf(0x1B, 0x45, n.toByte()))
        return this
    }

    /**
     * Write raw text
     */
    fun text(text: String): EscPosBuilder {
        try {
            val sanitized = sanitize(text)
            outputStream.write(sanitized.toByteArray(charset))
        } catch (e: Exception) {
            outputStream.write(text.toByteArray()) // Fallback
        }
        return this
    }

    /**
     * Normalize whitespace and remove non-printables
     */
    private fun sanitize(text: String): String {
        return text
            .replace(Regex("[\\t\\r]"), " ")
            .replace(Regex("\\s{2,}"), " ")
            .trim()
    }

    /**
     * Write text with a new line
     */
    fun textLine(text: String): EscPosBuilder {
        text(text)
        outputStream.write(0x0A) // LF
        return this
    }
    
    /**
     * Write text with truncation if too long
     */
    fun textTruncated(text: String, maxLength: Int): EscPosBuilder {
        val safeText = if (text.length > maxLength) {
            text.substring(0, maxLength)
        } else {
            text
        }
        return textLine(safeText)
    }

    /**
     * Feed paper n lines
     */
    fun feed(lines: Int): EscPosBuilder {
        repeat(lines) {
            outputStream.write(0x0A)
        }
        return this
    }

    /**
     * Draw a separator line (e.g. "--------------------------------")
     * @param len Optional Length of line. If null, auto-calculated based on current font/size (58mm defaults).
     * @param char Character to repeat
     */
    fun separator(len: Int? = null, char: Char = '-'): EscPosBuilder {
        val finalLen = len ?: calculateLineLength()
        val line = char.toString().repeat(finalLen)
        textLine(line)
        return this
    }

    private fun calculateLineLength(): Int {
        // Base width: Font A = 32, Font B = 42
        var width = if (currentFont == Font.A) 32 else 42
        
        // Adjust for size scaling (Double Width)
        if (currentSize == Size.DOUBLE_WIDTH || currentSize == Size.BIG) {
            width /= 2
        }
        return width
    }
    
    /**
     * Cut paper
     * GS V 66 0
     */
    fun cut(): EscPosBuilder {
        outputStream.write(byteArrayOf(0x1D, 0x56, 66, 0))
        return this
    }

    /**
     * Get the final byte array
     */
    fun getBytes(): ByteArray {
        return outputStream.toByteArray()
    }
}
