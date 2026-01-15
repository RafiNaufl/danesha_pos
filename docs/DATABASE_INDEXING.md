# Database Indexing Strategy

Untuk memastikan performa optimal pada modul Laporan (Reports), strategi indexing berikut diterapkan pada database PostgreSQL menggunakan Prisma ORM.

## Overview
Laporan keuangan memerlukan agregasi data yang berat berdasarkan rentang tanggal, kategori pelanggan, member, dan therapist. Tanpa index yang tepat, query ini akan menjadi lambat seiring bertambahnya data transaksi.

## Applied Indexes

### 1. Transaction Table
Tabel utama untuk semua penjualan.
- **`@@index([createdAt])`**: 
  - **Tujuan**: Mempercepat filter berdasarkan periode tanggal (`gte`, `lte`). Ini adalah filter utama untuk semua laporan.
- **`@@index([memberId])`**: 
  - **Tujuan**: Mempercepat pencarian transaksi untuk member tertentu.
- **`@@index([categoryId])`**: 
  - **Tujuan**: Mempercepat filter transaksi berdasarkan kategori pelanggan.

### 2. TransactionItem Table
Menyimpan detail item dalam setiap transaksi. Diperlukan untuk laporan detail dan perhitungan komisi per item.
- **`@@index([transactionId])`**: 
  - **Tujuan**: Mempercepat join antara `Transaction` dan `TransactionItem`. Penting karena PostgreSQL tidak otomatis mengindex Foreign Key.
- **`@@index([therapistId])`**: 
  - **Tujuan**: Mempercepat filter item berdasarkan therapist tertentu. Krusial untuk laporan "Total Komisi Therapist" dan performa therapist.

### 3. TherapistCommission Table
Menyimpan data komisi spesifik.
- **`@@index([therapistId])`**: 
  - **Tujuan**: Mempercepat agregasi total komisi per therapist.
- **`@@index([createdAt])`**: 
  - **Tujuan**: Membantu jika ada kebutuhan audit komisi berdasarkan waktu pencatatan.

## Performance Impact
- **Filter Periode**: Query menggunakan Range Scan pada index `createdAt` daripada Full Table Scan.
- **Filter Therapist**: Query agregasi komisi langsung menggunakan index `therapistId`, menghindari scan seluruh tabel item.
- **Joins**: Index pada Foreign Key (`transactionId`) mempercepat retrieval data relasi saat mengambil detail laporan.

## Maintenance
Pastikan untuk menjalankan `prisma migrate` atau `db push` untuk menerapkan index ini ke database produksi.
