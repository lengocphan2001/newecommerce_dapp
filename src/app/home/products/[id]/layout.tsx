// Required for static export with dynamic routes
export async function generateStaticParams() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  
  try {
    // Fetch products at build time
    const response = await fetch(`${API_BASE_URL}/products`, {
      cache: 'force-cache', // Cache during build
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch products for static generation, returning placeholder');
      // Return placeholder to satisfy Next.js static export requirement
      // Actual products will be handled client-side
      return [{ id: 'placeholder' }];
    }
    
    const data = await response.json();
    const products = Array.isArray(data) ? data : (data?.data || []);
    
    // If no products found, return placeholder
    if (!products || products.length === 0) {
      console.warn('No products found, returning placeholder');
      return [{ id: 'placeholder' }];
    }
    
    // Return array of params for each product
    return products.map((product: { id: string }) => ({
      id: product.id,
    }));
  } catch (error) {
    console.warn('Error fetching products for static generation:', error);
    // Return placeholder if API is not available during build
    // The page will still work client-side with dynamic routing
    return [{ id: 'placeholder' }];
  }
}

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

