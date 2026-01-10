// Server component - exports generateStaticParams for static export
// Required for static export with dynamic routes
// Orders require authentication, so we can't fetch them at build time
// Return a placeholder - actual orders will be handled client-side
export async function generateStaticParams() {
  // Next.js static export requires at least one param
  // Return a placeholder that will be handled by client-side routing
  return [{ id: 'placeholder' }];
}

import OrderDetailClient from './OrderDetailClient';

export default function OrderDetailsPage() {
  return <OrderDetailClient />;
}
