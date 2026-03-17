"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ProductForm from "@/components/admin/ProductForm";
import type { Product } from "@/types";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Không tìm thấy sản phẩm");
        return r.json();
      })
      .then((data) => setProduct(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-gray-400">Đang tải...</p>;
  }

  if (error || !product) {
    return <p className="text-red-600">{error || "Không tìm thấy sản phẩm"}</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Sửa sản phẩm</h1>
      <ProductForm product={product} />
    </div>
  );
}
