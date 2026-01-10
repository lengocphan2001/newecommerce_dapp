// Server component - exports generateStaticParams for static export
// Required for static export with dynamic routes
// IMPORTANT: This must return ALL product IDs to ensure all routes are generated
// If a product ID is not in this list, Next.js won't create the HTML file
// and .htaccess will rewrite to /index.html (login page)
export async function generateStaticParams() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  
  try {
    // Fetch products at build time
    const response = await fetch(`${API_BASE_URL}/products`, {
      cache: 'no-store', // Don't cache - we need fresh data at build time
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch products for static generation');
      // Return empty array - Next.js will still create the route structure
      // but we need to ensure all products are fetched
      return [];
    }
    
    const data = await response.json();
    const products = Array.isArray(data) ? data : (data?.data || []);
    
    // If no products found, return empty array
    if (!products || products.length === 0) {
      console.warn('No products found during static generation');
      return [];
    }
    
    console.log(`Generating static params for ${products.length} products`);
    
    // Return array of params for each product - THIS IS CRITICAL
    // All product IDs must be here, otherwise routes won't be generated
    return products.map((product: { id: string }) => ({
      id: product.id,
    }));
  } catch (error) {
    console.error('Error fetching products for static generation:', error);
    // Return empty array if API is not available during build
    // This means routes won't be pre-generated, but client-side routing should still work
    return [];
  }
}

import ProductDetailClient from './ProductDetailClient';

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
