# Modul Sistem Diskon - POS Danesha

## Ringkasan
Modul Diskon memungkinkan admin untuk membuat dan mengelola diskon untuk produk dan perawatan. Diskon dapat berupa persentase atau nominal tetap dan berlaku untuk periode waktu tertentu. Sistem secara otomatis menghitung harga diskon di POS dan mencegah penerapan diskon yang tumpang tindih.

## Fitur Utama
1.  **Diskon Per Item**: Targetkan produk atau perawatan spesifik.
2.  **Tipe Diskon**: Mendukung `PERCENT` (%) dan `NOMINAL` (Rp).
3.  **Periode Validitas**: Tentukan tanggal mulai dan berakhir.
4.  **Validasi Tumpang Tindih**: Mencegah konflik jadwal diskon untuk item yang sama.
5.  **Audit Logging**: Mencatat siapa yang membuat atau mengubah diskon.
6.  **Tampilan POS**: Menampilkan harga asli (dicoret) dan harga diskon, serta badge diskon.

## Struktur Data (Schema)
Model `Discount` memiliki relasi Many-to-Many dengan `Product` dan `Treatment`.

```prisma
model Discount {
  id          String       @id @default(cuid())
  name        String
  type        DiscountType // PERCENT | NOMINAL
  value       Decimal
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean      @default(true)
  products    Product[]
  treatments  Treatment[]
  // ... timestamps
}
```

## Panduan Penggunaan (Admin)

### 1. Membuat Diskon Baru
1.  Masuk ke Dashboard Admin -> **Diskon**.
2.  Klik tombol **+ Diskon Baru**.
3.  Isi formulir:
    *   **Nama**: Judul promo (misal: "Promo Merdeka").
    *   **Tipe**: Pilih Persen atau Nominal.
    *   **Nilai**: Masukkan angka (misal: 10 untuk 10% atau 5000 untuk Rp 5.000).
    *   **Periode**: Pilih tanggal mulai dan selesai.
    *   **Target**: Centang produk dan/atau perawatan yang termasuk dalam diskon ini.
4.  Klik **Simpan**.

> **Catatan**: Sistem akan menolak penyimpanan jika ada produk yang dipilih sedang memiliki diskon aktif lain pada periode yang sama.

### 2. Mengelola Status
*   Gunakan toggle **Aktif/Nonaktif** di tabel daftar diskon untuk mematikan diskon secara instan tanpa menghapusnya.
*   Diskon yang tidak aktif tidak akan dihitung di POS meskipun tanggalnya masih berlaku.

## Detail Teknis & Contoh Kode

### Perhitungan Diskon
Logika perhitungan terpusat di `lib/discount-utils.ts`.

```typescript
import { calculateDiscount } from '@/lib/discount-utils'

// Contoh penggunaan
const basePrice = 100000
const discount = {
  type: 'PERCENT',
  value: 20,
  isActive: true,
  startDate: '2024-01-01',
  endDate: '2024-12-31'
}

const { finalPrice, discountAmount } = calculateDiscount(basePrice, discount)
// Result: finalPrice = 80000, discountAmount = 20000
```

### Validasi Overlap (Server Action)
Saat menyimpan diskon, sistem memeriksa database untuk konflik:
```typescript
// Pseudocode logika validasi
const conflicts = await prisma.discount.findMany({
  where: {
    isActive: true,
    products: { some: { id: { in: newProductIds } } },
    startDate: { lte: newEndDate },
    endDate: { gte: newStartDate }
  }
})
if (conflicts.length > 0) throw new Error("Bertabrakan!")
```

### Integrasi Frontend (POS)
Di komponen React, gunakan data diskon yang sudah diserialisasi:

```tsx
// Menampilkan harga
const { finalPrice } = calculateDiscount(product.price, product.discount)

return (
  <div>
    {finalPrice < product.price && (
      <span className="line-through text-gray-400">{product.price}</span>
    )}
    <span className="text-red-600">{finalPrice}</span>
  </div>
)
```

## Pengujian
Unit test tersedia di `lib/discount-utils.test.ts`.
Jalankan test dengan perintah:
```bash
npm test
```
