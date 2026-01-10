// Required for static export with dynamic routes
export async function generateStaticParams() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  
  try {
    // Fetch products at build time
    const response = await fetch(`${API_BASE_URL}/products`, {
      cache: 'force-cache', // Cache during build
    });
    
    if (!response.ok) {
      console.warn('Failed to fetch products for static generation, returning empty array');
      return [];
    }
    
    const data = await response.json();
    const products = Array.isArray(data) ? data : (data?.data || []);
    
    // Return array of params for each product
    return products.map((product: { id: string }) => ({
      id: product.id,
    }));
  } catch (error) {
    console.warn('Error fetching products for static generation:', error);
    // Return empty array if API is not available during build
    // The page will still work client-side
    return [];
  }
}

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

