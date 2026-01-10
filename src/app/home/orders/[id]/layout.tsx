// Required for static export with dynamic routes
// Orders require authentication, so we can't fetch them at build time
// Return a placeholder param - actual orders will be handled client-side
export async function generateStaticParams() {
  // Return at least one placeholder to satisfy Next.js static export requirement
  // The actual order pages will be handled client-side with dynamic routing
  return [
    { id: 'placeholder' }, // Placeholder to satisfy Next.js requirement
  ];
}

export default function OrderDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
