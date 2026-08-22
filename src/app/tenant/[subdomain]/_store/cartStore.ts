import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { StorefrontGrindSize } from '@/lib/storefront-grind';

export interface CartItem {
  id: string;
  productId: string | null;
  offeringId?: string | null;
  variantId?: string | null;
  code: string;
  name: string;
  imageUrl: string | null;
  price: number;
  quantity: number;
  grindSize: StorefrontGrindSize;
  customGrindLabel: string | null;
  packageName?: string | null;
  netWeightGrams?: number | null;
  roastLevel?: string | null;
}

interface CartState {
  items: Record<string, CartItem[]>;
  hasHydrated: boolean;
  markHydrated: (value: boolean) => void;
  addItem: (tenantId: string, product: Omit<CartItem, "quantity">) => void;
  removeItem: (tenantId: string, id: string) => void;
  updateQuantity: (tenantId: string, id: string, delta: number) => void;
  clearCart: (tenantId: string) => void;
  getTotalItems: (tenantId: string) => number;
  getTotalPrice: (tenantId: string) => number;
}

export function createCartStore(storage?: StateStorage) {
  return create<CartState>()(
  persist(
    (set, get) => ({
      items: {},
      hasHydrated: false,
      markHydrated: (value) => set({ hasHydrated: value }),
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
      version: 1,
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => state?.markHydrated(true),
      ...(storage ? { storage: createJSONStorage(() => storage) } : {}),
    }
  )
  );
}

export const useCartStore = createCartStore();
