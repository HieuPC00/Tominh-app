export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  category: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  status: "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";
  total: number;
  items: OrderItem[];
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}
