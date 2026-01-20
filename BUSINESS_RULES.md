# Aturan Bisnis Sistem POS Danesha

Dokumen ini mengatur standar perhitungan keuangan, penanganan komisi, dan pelaporan untuk memastikan konsistensi, keamanan audit, dan akurasi data.

## 1. Single Source of Truth (Financial Authority)

Semua nilai keuangan final (subtotal, diskon, total, biaya, komisi, profit) **HANYA** boleh dihitung saat checkout (server-side).

*   **DILARANG:** Modul laporan menghitung ulang nilai dari master data (harga, komisi, diskon).
*   **WAJIB:** Laporan membaca snapshot dari tabel:
    *   `Transaction`
    *   `TransactionItem`
    *   `TherapistCommission`

Kode backend ditandai dengan: `// FINANCIAL SNAPSHOT — reports must not recompute`

## 2. Definisi Nilai Keuangan (Anti Double Count)

Definisi matematis ini bersifat mutlak dan tidak boleh dilanggar.

### A. Item Level (TransactionItem)

```
lineSubtotal         = unitPrice × qty
lineDiscount         = hasil diskon (percent / nominal)
lineTotal            = lineSubtotal − lineDiscount
commissionBaseAmount = lineTotal
totalCommissionItem  = sum(TherapistCommission.amount)

costPrice (Total)    = snapshot total modal item (sudah qty-adjusted, bukan per unit)
profit               = lineTotal − costPrice (Total) − totalCommissionItem
```

**PENTING:** Komisi dianggap sebagai **BIAYA**, sehingga mengurangi profit bersih item tersebut. Laporan tidak perlu mengurangi komisi lagi dari profit yang tersimpan.

### B. Transaction Level (Transaction)

```
subtotal        = sum(lineSubtotal)
discountTotal   = sum(lineDiscount)
total           = sum(lineTotal)
costTotal       = sum(costPrice Total)
commissionTotal = sum(TherapistCommission.amount)
profitTotal     = sum(profit)
```

**PENTING:** `profitTotal` adalah penjumlahan dari profit item (yang sudah bersih dari komisi). Tidak boleh dikurangi komisi lagi di laporan.

### 2.1 Definisi Akuntansi Internal (Mapping Istilah)

Untuk keperluan audit, akuntansi, dan integrasi software pihak ketiga, berikut adalah pemetaan istilah teknis ke istilah akuntansi:

*   **Pendapatan (Revenue)** = `lineTotal`
*   **Biaya Pokok (COGS)** = `costPrice` (Total Modal Barang/Jasa)
*   **Biaya Jasa (Service Cost)** = `TherapistCommission` (Komisi Terapis)
*   **Laba Bersih (Net Profit)** = `profit`

## 3. Komisi Terapis (Snapshot & Immutable)

*   Komisi selalu disimpan sebagai snapshot di tabel `TherapistCommission`.
*   Perubahan pada level terapis, persen komisi, atau setting global **TIDAK MEMPENGARUHI** transaksi lama.
*   Rumus: `TherapistCommission.amount = commissionBaseAmount × commissionPercent`
*   Satu `TransactionItem` boleh memiliki maksimal 2 komisi (Main + Assistant).

## 4. Omzet vs Pendapatan Terapis (Clarity Rule)

*   **Omzet** = Milik bisnis (tercatat di `Transaction` / `TransactionItem`).
*   **Komisi** = Hak terapis.
*   Terapis tidak memiliki "Omzet". Jika laporan menampilkan "Omzet Terapis", nilai tersebut hanya **referensi performa**, bukan nilai keuangan resmi yang dimiliki terapis.

## 5. Reporting Guard (Audit Safety)

Laporan harus bebas dari efek samping perubahan master data.

*   ❌ **DILARANG JOIN** ke: `ProductPrice`, `TreatmentPrice`, `TherapistLevel`, `Settings` untuk tujuan kalkulasi nilai.
*   ✅ **HANYA MEMBACA**: `Transaction`, `TransactionItem`, `TherapistCommission`.
*   🚫 **NO RECALCULATION**: Laporan tidak boleh melakukan update, recalculation, atau enrichment data, hanya agregasi (SUM, COUNT) dari snapshot.

Kode laporan ditandai dengan: `// REPORTING GUARD — read-only, snapshot-based`

## 6. Rounding & Konsistensi Angka

*   Metode pembulatan: **HALF_UP**
*   Presisi: **2 decimal places**
*   Pembulatan dilakukan saat **checkout**, bukan saat pelaporan.

## 7. Audit & Traceability Rule

Setiap angka di laporan harus bisa ditelusuri ke sumbernya tanpa rekalkulasi:
`Report` → `Transaction` → `TransactionItem` → `TherapistCommission`

## 8. Failure Safety

*   Checkout harus idempotent (menggunakan `checkoutSessionId`).
*   Kegagalan logging atau stock movement tidak boleh membatalkan transaksi keuangan yang sudah valid.
*   **REKONSILIASI**: Namun kegagalan tersebut WAJIB dicatat (AuditLog / CheckoutFailure) untuk rekonsiliasi agar error tidak tersembunyi.
