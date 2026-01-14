"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  thumbnailUrl?: string;
}

interface AnimationState {
  isAnimating: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface ShoppingCartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, buttonElement?: HTMLElement | null) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  animation: AnimationState | null;
}

const ShoppingCartContext = createContext<ShoppingCartContextType | undefined>(undefined);

const STORAGE_KEY = "shopping_cart";

export function ShoppingCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [animation, setAnimation] = useState<AnimationState | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">, buttonElement?: HTMLElement | null) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });

    // Trigger animation if button element is provided
    if (buttonElement && typeof window !== "undefined") {
      const buttonRect = buttonElement.getBoundingClientRect();
      const startX = buttonRect.left + buttonRect.width / 2;
      const startY = buttonRect.top + buttonRect.height / 2;

      // Try to find cart icon - check header first, then bottom nav
      let cartRect: DOMRect | null = null;
      
      const headerCart = document.querySelector('[data-cart-icon]') as HTMLElement;
      const bottomNavCart = document.querySelector('[data-bottom-nav-cart]') as HTMLElement;
      
      if (headerCart) {
        cartRect = headerCart.getBoundingClientRect();
      } else if (bottomNavCart) {
        cartRect = bottomNavCart.getBoundingClientRect();
      }

      if (!cartRect) {
        // If cart not found, use a default position (top right)
        cartRect = {
          left: window.innerWidth - 60,
          top: 20,
          width: 40,
          height: 40,
          right: window.innerWidth - 20,
          bottom: 60,
          x: window.innerWidth - 60,
          y: 20,
          toJSON: () => {},
        } as DOMRect;
      }

      const endX = cartRect.left + cartRect.width / 2;
      const endY = cartRect.top + cartRect.height / 2;

      setAnimation({
        isAnimating: true,
        startX,
        startY,
        endX,
        endY,
      });

      // Clear animation after it completes
      setTimeout(() => {
        setAnimation(null);
      }, 800);
    }
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <ShoppingCartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
        animation,
      }}
    >
      {children}
    </ShoppingCartContext.Provider>
  );
}

export function useShoppingCart() {
  const context = useContext(ShoppingCartContext);
  if (!context) {
    throw new Error("useShoppingCart must be used within ShoppingCartProvider");
  }
  return context;
}
