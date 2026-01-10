// Server component - exports generateStaticParams for static export
// Required for static export with dynamic routes
// Orders require authentication, so we can't fetch them at build time
// Return empty array - actual orders will be handled client-side via .htaccess rewrite
export async function generateStaticParams() {
  // Return empty array - Next.js will still create the route structure
  // but actual order routes will be handled by client-side routing via .htaccess
  return [];
}

import OrderDetailClient from './OrderDetailClient';

export default function OrderDetailsPage() {
  return <OrderDetailClient />;
}
