"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import AppHeader from "@/app/components/AppHeader";
import { api } from "@/app/services/api";
import { useShoppingCart } from "@/app/contexts/ShoppingCartContext";

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  thumbnailUrl?: string;
  detailImageUrls?: string[];
  createdAt: string;
}

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const { addItem, items } = useShoppingCart();

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const data = await api.getProduct(productId);
      setProduct(data);
    } catch (error) {
      console.error("Failed to fetch product:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    }).format(price);
  };

  const handleAddToCart = () => {
    if (!product || product.stock === 0) return;

    // Thêm sản phẩm với số lượng đã chọn
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        productName: product.name,
        price: product.price,
        thumbnailUrl: product.thumbnailUrl,
      });
    }

    // Hiển thị thông báo thành công
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleBuyNow = () => {
    if (!product || product.stock === 0) return;

    // Thêm vào giỏ hàng với số lượng đã chọn
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        productName: product.name,
        price: product.price,
        thumbnailUrl: product.thumbnailUrl,
      });
    }

    // Chuyển đến trang checkout
    router.push("/home/checkout");
  };

  // Lấy số lượng sản phẩm hiện tại trong giỏ hàng
  const cartItem = items.find((item) => item.productId === productId);
  const currentQuantityInCart = cartItem?.quantity || 0;

  const allImages = product
    ? [
        product.thumbnailUrl,
        ...(product.detailImageUrls || []),
      ].filter(Boolean) as string[]
    : [];

  if (loading) {
    return (
      <div className="flex flex-col bg-zinc-50">
        <AppHeader titleKey="productsTitle" />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-8">
            <div className="animate-pulse space-y-4">
              <div className="aspect-square bg-zinc-200 rounded-xl"></div>
              <div className="h-6 bg-zinc-200 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
              <div className="h-20 bg-zinc-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col bg-zinc-50">
        <AppHeader titleKey="productsTitle" />
        <main className="flex-1">
          <div className="mx-auto max-w-2xl px-4 py-8 text-center">
            <p className="text-zinc-500">Không tìm thấy sản phẩm</p>
            <button
              onClick={() => router.back()}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Quay lại
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-zinc-50">
      <AppHeader titleKey="productsTitle" />
      <main className="flex-1 pb-32">
        <div className="mx-auto max-w-2xl">
          {/* Image Gallery */}
          <div className="bg-white">
            <div className="relative aspect-square w-full overflow-hidden">
              {allImages.length > 0 ? (
                <img
                  src={allImages[selectedImageIndex]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-6xl text-zinc-400">
                  📦
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-4 py-3">
                {allImages.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 ${
                      selectedImageIndex === index
                        ? "border-blue-600"
                        : "border-zinc-200"
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="bg-white px-4 py-4">
            <h1 className="text-xl font-bold text-zinc-900">{product.name}</h1>
            <div className="mt-2">
              <p className="text-2xl font-bold text-blue-600">
                ${product.price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })} USDT
              </p>
            </div>
            {product.stock > 0 ? (
              <p className="mt-2 text-sm text-zinc-600">
                Còn {product.stock} sản phẩm
              </p>
            ) : (
              <p className="mt-2 text-sm text-red-500">Hết hàng</p>
            )}
            {currentQuantityInCart > 0 && (
              <p className="mt-1 text-sm text-blue-600">
                Đã có {currentQuantityInCart} sản phẩm trong giỏ hàng
              </p>
            )}
          </div>

          {/* Quantity Selector */}
          {product.stock > 0 && (
            <div className="mt-2 bg-white px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900">Số lượng:</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className="w-12 text-center font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div className="mt-2 bg-white px-4 py-4">
              <h2 className="mb-2 text-lg font-semibold text-zinc-900">
                Mô tả sản phẩm
              </h2>
              <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-20 left-1/2 z-[120] -translate-x-1/2 transform">
          <div className="rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
            Đã thêm {quantity} sản phẩm vào giỏ hàng!
          </div>
        </div>
      )}

      {/* Fixed Action Buttons - Above Bottom Nav */}
      <div className="fixed bottom-20 left-0 right-0 z-[110] p-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              product.stock === 0
                ? "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                : "bg-blue-600 text-white active:bg-blue-700"
            }`}
          >
            {product.stock === 0 ? "Hết hàng" : "Thêm vào giỏ"}
          </button>
          <button
            onClick={handleBuyNow}
            disabled={product.stock === 0}
            className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
              product.stock === 0
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-orange-500 text-white active:bg-orange-600"
            }`}
          >
            Mua ngay
          </button>
        </div>
      </div>
    </div>
  );
}

