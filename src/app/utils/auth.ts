/**
 * Utility functions for handling authentication errors
 */

/**
 * Checks if an error is an authentication error
 * and redirects to home page if so
 */
export function handleAuthError(error: any, router: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  const isAuthError = 
    errorMessage.includes('Not authenticated') ||
    errorMessage.includes('Authentication expired') ||
    errorMessage.includes('401') ||
    error?.status === 401 ||
    error?.response?.status === 401;

  if (isAuthError) {
    // Clear token if exists
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    
    // Redirect to home page for re-authentication
    if (router) {
      router.push('/');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
    
    return true;
  }
  
  return false;
}
