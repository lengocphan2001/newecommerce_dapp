import { Suspense } from 'react';
import OrderDetailClient from './OrderDetailClient';

export default function OrderDetailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <span className="material-symbols-outlined animate-spin text-blue-600 text-3xl">refresh</span>
      </div>
    }>
      <OrderDetailClient />
    </Suspense>
  );
}
