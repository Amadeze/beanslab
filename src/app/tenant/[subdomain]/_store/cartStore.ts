import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StorefrontGrindSize } from '@/lib/storefront-grind';

export interface CartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  grindSize: StorefrontGrindSize;
  customGrindLabel: string | null;
}

interface CartState {
  items: Record<string, CartItem[]>;
  addItem: (tenantId: string, product: Omit<CartItem, "quantity">) => void;
  removeItem: (tenantId: string, id: string) => void;
  updateQuantity: (tenantId: string, id: string, delta: number) => void;
  clearCart: (tenantId: string) => void;
  getTotalItems: (tenantId: string) => number;
  getTotalPrice: (tenantId: string) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: {},
      addItem: (tenantId, product) => {
        set((state) => {
          const tenantItems = state.items[tenantId] || [];
          const existingItem = tenantItems.find((item) => item.id === product.id);
          if (existingItem) {
            return {
              items: {
                ...state.items,
                [tenantId]: tenantItems.map((item) =>
                  item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                ),
              }
            };
          }
          return { items: { ...state.items, [tenantId]: [...tenantItems, { ...product, quantity: 1 }] } };
        });
      },
      removeItem: (tenantId, id) => {
        set((state) => ({
          items: {
            ...state.items,
            [tenantId]: (state.items[tenantId] || []).filter((item) => item.id !== id),
          }
        }));
      },
      updateQuantity: (tenantId, id, delta) => {
        set((state) => ({
          items: {
            ...state.items,
            [tenantId]: (state.items[tenantId] || []).map((item) => {
              if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
              }
              return item;
            }),
          }
        }));
      },
      clearCart: (tenantId) => set((state) => ({ items: { ...state.items, [tenantId]: [] } })),
      getTotalItems: (tenantId) => {
        return (get().items[tenantId] || []).reduce((total, item) => total + item.quantity, 0);
      },
      getTotalPrice: (tenantId) => {
        return (get().items[tenantId] || []).reduce((total, item) => total + (item.price * item.quantity), 0);
      },
    }),
    {
      name: 'ros-b2b-cart', // Unique key for local storage
    }
  )
);
