import { Suspense } from 'react';
import ProductDetailClient from './ProductDetailClient';

export default function ProductDetailPage() {
  return (
    <Suspense fallback={
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden pb-32 bg-background-gray">
        <div className="animate-pulse space-y-4 p-4">
          <div className="aspect-[4/5] bg-gray-200 rounded-b-[2.5rem]"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    }>
      <ProductDetailClient />
    </Suspense>
  );
}
