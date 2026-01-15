import { getProducts } from "@/app/actions/admin/products"
import { getCustomerCategories } from "@/app/actions/admin/members"
import { ProductsClient } from "./client"

export default async function Page() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCustomerCategories()
  ])

  return <ProductsClient initialProducts={products} categories={categories} />
}
