export type ProductCategory = 'panini-del-mese' | 'hamburger' | 'american-sandwich' | 'sandwich-maiale' | 'sandwich-pollo' | 'veggy' | 'kids-junior' | 'chips' | 'starter' | 'box' | 'dolci' | 'salse' | 'drink';

export interface ProductVariant {
  name: string;
  price: number;
}

export interface Product {
  id: number | string;
  name:string;
  price: number;
  menuPrice?: number;
  description: string;
  image: string;
  category: ProductCategory;
  ingredients?: string[];
  removableIngredients?: string[];
  isDrink?: boolean;
  galleryImages?: string[];
  imagePosition?: string;
  imageFit?: 'cover' | 'contain';
  variants?: ProductVariant[];
  availableDays?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  extras?: Extra[];
  isVisible?: boolean;
}

export type CartItemVariant = 'panino' | 'menu';

export interface Extra {
  name: string;
  price: number;
}

export interface Profile {
  id: string;
  userCode: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  isAdmin: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface OrderCustomerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address?: string;
}

export interface OrderRecipientInfo {
  name: string;
  phone: string;
  address?: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'delivering' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'paid';
  paymentMethod: 'delivery' | 'card';
  totalPrice: number;
  deliveryType: 'pickup' | 'delivery';
  customerInfo: OrderCustomerInfo;
  isForSomeoneElse: boolean;
  recipientInfo?: OrderRecipientInfo;
  createdAt: any;
  updatedAt: any;
  items?: OrderItem[];
  notes?: string;
  scheduledTime?: string; // ISO or human-readable time
  estimatedPrepTime?: number; // minutes
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: number;
  productName: string;
  quantity: number;
  priceAtPurchase: number;
  configuration: {
    variant: CartItemVariant;
    removedIngredients: string[];
    addedExtras: SelectedExtra[];
    selectedDrinkId?: number;
    selectedFrySauces?: string[];
    notes: string;
  };
}

export interface SelectedExtra {
  name: string;
  price: number;
}

export interface CartItem {
  id: string; // Unique identifier for each cart item instance
  product: Product;
  quantity: number;
  notes: string;
  variant: CartItemVariant;
  
  // Customizations
  removedIngredients: string[];
  addedExtras: SelectedExtra[];
  
  // For 'menu' variant
  selectedDrink?: Product;
  selectedFrySauces?: string[];

  // Calculated price for this specific configured item
  finalPrice: number;
}