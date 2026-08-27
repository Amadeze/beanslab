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
  basePrice?: number;
  priceBreaks?: Array<{ id: string; minQuantity: number; unitPrice: number; tierName: string }>;
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
  replaceCart: (tenantId: string, items: CartItem[]) => void;
  clearCart: (tenantId: string) => void;
  getTotalItems: (tenantId: string) => number;
  getTotalPrice: (tenantId: string) => number;
}

export function resolveCartItemPrice(item: Pick<CartItem, "price" | "basePrice" | "priceBreaks">, quantity: number) {
  const eligible = (item.priceBreaks ?? [])
    .filter((price) => price.minQuantity <= quantity && price.unitPrice > 0)
    .sort((left, right) => right.minQuantity - left.minQuantity)[0];
  return eligible?.unitPrice ?? item.basePrice ?? item.price;
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
            const quantity = existingItem.quantity + 1;
            return {
              items: {
                ...state.items,
                [tenantId]: tenantItems.map((item) =>
                  item.id === product.id
                    ? { ...item, ...product, quantity, price: resolveCartItemPrice({ ...item, ...product }, quantity) }
                    : item
                ),
              }
            };
          }
          return {
            items: {
              ...state.items,
              [tenantId]: [...tenantItems, {
                ...product,
                quantity: 1,
                price: resolveCartItemPrice(product, 1),
              }],
            },
          };
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
                return { ...item, quantity: newQty, price: resolveCartItemPrice(item, newQty) };
              }
              return item;
            }),
          }
        }));
      },
      replaceCart: (tenantId, items) => set((state) => ({
        items: {
          ...state.items,
          [tenantId]: items.map((item) => ({
            ...item,
            quantity: Math.max(1, Math.floor(item.quantity)),
            price: resolveCartItemPrice(item, Math.max(1, Math.floor(item.quantity))),
          })),
        },
      })),
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
