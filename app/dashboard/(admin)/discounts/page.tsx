import { requireAdmin } from "@/app/lib/admin-auth"
import { DiscountsClient } from "./client"
import { getDiscounts } from "@/app/actions/admin/discounts"
import { getProducts } from "@/app/actions/admin/products"
import { getTreatments } from "@/app/actions/admin/treatments"

export default async function DiscountsPage() {
  await requireAdmin()
  const [discounts, products, treatments] = await Promise.all([
    getDiscounts(),
    getProducts(),
    getTreatments()
  ])
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Diskon</h1>
        <p className="text-muted-foreground">Atur diskon dan promosi produk/treatment</p>
      </div>
      
      <DiscountsClient 
        initialDiscounts={discounts} 
        products={products}
        treatments={treatments}
      />
    </div>
  )
}
