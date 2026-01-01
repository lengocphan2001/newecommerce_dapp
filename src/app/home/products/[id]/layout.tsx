// Required for static export with dynamic routes
export function generateStaticParams() {
  // Return empty array - routes will be handled client-side
  return [];
}

export default function ProductDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

