import OrderDetailClient from './OrderDetailClient';

// Server component - exports generateStaticParams for static export
// Required for static export with dynamic routes
// Orders require authentication, so we can't fetch them at build time
// Return at least one placeholder - actual orders will be handled client-side
export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Next.js static export requires at least one param
  // Return a placeholder that will be handled by client-side routing
  // The .htaccess will rewrite all /home/orders/* to /index.html for client-side routing
  return [{ id: 'placeholder' }];
}

export default function OrderDetailsPage() {
  return <OrderDetailClient />;
}
