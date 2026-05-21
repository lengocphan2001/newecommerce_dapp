import { Suspense } from 'react';
import OrderDetailClient from './OrderDetailClient';

// Se fuerza la renderización dinámica de la página para evitar que Next.js almacene estáticamente los detalles de los pedidos, asegurando datos actualizados en cada petición.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
