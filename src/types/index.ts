export type UserRole = "admin" | "customer";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  images: string[];
  stock: number;
  sku: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total: number;
  shipping_address: string | null;
  shipping_phone: string | null;
  shipping_name: string | null;
  payment_status: PaymentStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface InventoryLog {
  id: string;
  product_id: string;
  change_amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}
