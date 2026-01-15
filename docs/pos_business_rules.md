# POS Danesha — Business Rules & Technical Schema

## Ringkasan

- Harga Produk mengikuti `CustomerCategory` (server-side); Treatment memakai `sellPrice` tunggal.
- Member terikat ke satu kategori; kategori menentukan harga Produk di POS.
- Checkout idempotent melalui `checkoutSessionId` untuk mencegah transaksi ganda.
- Validasi stok dilakukan dalam transaksi dengan row-level lock.
- Semua angka uang dibulatkan `ROUND_HALF_UP` 2 desimal dan disimpan sebagai snapshot.
- Komisi therapist dihitung dari harga setelah diskon dan disimpan sebagai snapshot.
- Laporan agregasi memakai snapshot item dan komisi; tidak hitung ulang harga.
- Kegagalan checkout dicatat untuk audit.
- Harga tidak pernah diambil dari client; seluruh perhitungan dilakukan di server.
- Diskon hanya berasal dari input checkout; tidak ada auto-discount dari tabel `Discount`.
- Unit cost pada `StockMovement` SALE diambil dari snapshot `TransactionItem.costPrice`.
- Filter kategori pada laporan hanya mempengaruhi Produk; Treatment mengabaikan filter kategori.

## Model Inti

- `User` (Admin/Kasir) — relasi transaksi cashier: `prisma/schema.prisma:37-46`
- `CustomerCategory` — sumber harga per kategori (kode unik): `prisma/schema.prisma:48-58`
- `Member` — relasi ke kategori dan status aktif/nonaktif: `prisma/schema.prisma:60-73`
- `Product` — HPP `costPrice`; relasi harga per kategori: `prisma/schema.prisma:75-88`
- `ProductPrice` — harga jual per kategori: `prisma/schema.prisma:90-98`
- `Treatment` — HPP `costPrice`, `sellPrice` tunggal: `prisma/schema.prisma:100-114`
- `Discount` — tipe `PERCENT` / `NOMINAL`, periode aktif: `prisma/schema.prisma:231-246`
- `Therapist` — harus aktif untuk dipakai di checkout: `prisma/schema.prisma:126-135`
- `Transaction` — totals dan audit category: `prisma/schema.prisma:137-163`
- `TransactionItem` — snapshot harga akhir, qty, discount, profit: `prisma/schema.prisma:165-189`
- `TherapistCommission` — snapshot komisi: `prisma/schema.prisma:192-208`
- `StockMovement` — IN/OUT/ADJUST/SALE: `prisma/schema.prisma:209-220`
- `Settings` — default commission percent: `prisma/schema.prisma:222-229`
- `CheckoutFailure` — log gagal checkout: `prisma/schema.prisma:210-215`

## Pricing Rules

- Produk: harga ambil dari `ProductPrice` berdasarkan `categoryId` member (perhitungan di server, bukan dari client).
- Treatment: harga dari `Treatment.sellPrice` (kategori tidak mempengaruhi).
- POS mereprice item Produk saat kategori member berubah: `app/dashboard/pos/components/pos-provider.tsx:113-121`.

## Diskon

- Diskon per item line dengan `DiscountType` PERCENT atau NOMINAL.
- Server validasi: tidak boleh negatif; tidak boleh ≥ harga line; final price > 0.
- Perhitungan line totals (server): `app/lib/calculations.ts:3-14`.
- Response checkout mengandung info UX: "Diskon diterapkan ke TOTAL qty, bukan per item".
- Tidak ada auto-discount dari tabel `Discount`; kasir memasukkan nilai diskon secara eksplisit di checkout.

## Checkout Flow

1. Client kirim `checkoutSessionId` (UUID v4) bersama cart, method, dan pembayaran.
2. Server cek idempotency; jika sudah ada transaksi untuk key yang sama, kembalikan transaksi lama.
3. Server ambil kategori (dari member atau default), harga resmi server-side, dan hitung line totals.
4. Validasi therapist aktif untuk Treatment.
5. Lock baris Product dan validasi stok dalam transaksi; tolak jika stok kurang.
6. Hitung komisi therapist dari `lineTotal` setelah diskon; simpan snapshot.
7. Simpan `Transaction` + `TransactionItem`; buat `StockMovement` SALE dengan `unitCost` dari snapshot `TransactionItem.costPrice`.
8. Kembalikan response berisi items dan totals.

## Payment Methods

- Supported methods: CASH, TRANSFER, QRIS.
- **QRIS Note**: Implementasi saat ini adalah placeholder UI dan pencatatan. Tidak ada integrasi sistem QRIS eksternal (static display only).
- Disimpan di `Transaction.paymentMethod` sebagai string.
- Laporan memisahkan transaksi berdasarkan metode pembayaran.

## Concurrency & Safety

- Idempotency: `Transaction.checkoutSessionId @unique`. Request berulang → return transaksi lama.
- Stok: `SELECT ... FOR UPDATE` terhadap Product; validasi stok berdasarkan akumulasi `StockMovement` sebelum create.
- Therapist state: wajib aktif; jika nonaktif, checkout ditolak.
- Failure log: simpan `CheckoutFailure` saat exception dengan payload ringkas.
- Status transaksi diset eksplisit ke `PAID` saat create, dan divalidasi pasca-create.

## Money & Rounding

- Standar: Decimal, `ROUND_HALF_UP`, 2 desimal.
- Terapkan pada unit price, subtotal, discount, line total, cost total, profit, komisi, paid & change.
- Implementasi: `app/lib/calculations.ts:3-14` dan rounding totals di `app/actions/checkout.ts:147-153`.

## Komisi Therapist

- Basis komisi: `lineTotal` setelah diskon.
- Snapshot fields: `commissionBaseAmount`, `commissionPercent`, `commissionAmount`.
- Disimpan per `TransactionItem` agar audit-safe.

## Reports

- General: sum `TransactionItem.lineTotal`, `lineDiscount`, `profit` untuk Product/Treatment; cost = omzet − laba.
- Komisi: dari `TherapistCommission` snapshot; prefer `commissionAmount`, fallback `amount`.
- Tidak membaca settings live atau hitung ulang harga/komisi.
- Implementasi: `app/actions/reports.ts:144-165` dan therapist mode `app/actions/reports.ts:66-98`.
- Filter kategori hanya diterapkan pada agregasi Produk (`whereTxProduct`); agregasi Treatment mengabaikan filter kategori (`whereTxTreatment`): `app/actions/reports.ts:147-154, 151-154, 230-234`.

## Admin UI & Forms

- Products: input "Harga Jual per Kategori" untuk setiap kategori: `app/dashboard/(admin)/products/client.tsx:176-208`.
- Treatments: input `sellPrice` tunggal: `app/dashboard/(admin)/treatments/client.tsx`.
- Kategori dikirim dari page: `app/dashboard/(admin)/products/page.tsx:6-11`.

## Seed & Default

- Kategori default: PASIEN, RESELLER, MEMBER, AGEN — `prisma/seed.ts:38-54`.
- Jalankan: `npx prisma db seed`.

## Testing & CI
