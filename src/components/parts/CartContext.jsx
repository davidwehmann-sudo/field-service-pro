import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    const saved = localStorage.getItem('partsCart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('partsCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (part) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.part_number === part.part_number);
      if (existing) {
        return prev.map(item =>
          item.part_number === part.part_number
            ? { ...item, quantity: item.quantity + (part.quantity || 1) }
            : item
        );
      }
      return [...prev, { ...part, quantity: part.quantity || 1, notes: '' }];
    });
  };

  const addMultipleToCart = (parts) => {
    parts.forEach(part => addToCart(part));
  };

  const updateCartItem = (part_number, updates) => {
    setCartItems(prev =>
      prev.map(item =>
        item.part_number === part_number ? { ...item, ...updates } : item
      )
    );
  };

  const removeFromCart = (part_number) => {
    setCartItems(prev => prev.filter(item => item.part_number !== part_number));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        cartCount,
        addToCart,
        addMultipleToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}