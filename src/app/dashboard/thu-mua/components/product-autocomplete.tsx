"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface ProductOption {
  id: string;
  ma_hang_hoa: string;
  ten: string;
  don_vi_tinh?: { ten_dvt: string };
  gia_binh_quan: number;
}

interface ProductAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (product: {
    id: string;
    ma_hang_hoa: string;
    ten: string;
    don_vi_tinh?: { ten_dvt: string };
    gia_binh_quan: number;
  }) => void;
  placeholder?: string;
}

export default function ProductAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Tìm theo mã hoặc tên hàng hóa...",
}: ProductAutocompleteProps) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchProducts = useCallback(async (query: string) => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/wms/hang-hoa?search=${encodeURIComponent(query)}&limit=10`
      );
      const data = await res.json();
      setOptions(data?.data || []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setOptions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchProducts(value);
      setOpen(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchProducts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(product: ProductOption) {
    onSelect({
      id: product.id,
      ma_hang_hoa: product.ma_hang_hoa,
      ten: product.ten,
      don_vi_tinh: product.don_vi_tinh,
      gia_binh_quan: product.gia_binh_quan,
    });
    onChange(product.ten);
    setOpen(false);
  }

  function formatPrice(n: number): string {
    return Number(n) > 0 ? Number(n).toLocaleString("vi-VN") : "—";
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (options.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
      />

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[500px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Đang tìm...
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Không tìm thấy hàng hóa
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="grid grid-cols-[100px_1fr_80px_100px] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                <span>Mã</span>
                <span>Tên hàng</span>
                <span>ĐVT</span>
                <span className="text-right">Giá</span>
              </div>
              <div className="max-h-60 overflow-auto">
                {options.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className="grid w-full grid-cols-[100px_1fr_80px_100px] gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-800"
                  >
                    <span className="truncate font-mono text-xs text-blue-600 dark:text-blue-400">
                      {p.ma_hang_hoa}
                    </span>
                    <span className="truncate text-gray-900 dark:text-gray-100">
                      {p.ten}
                    </span>
                    <span className="truncate text-xs text-gray-500">
                      {p.don_vi_tinh?.ten_dvt || "—"}
                    </span>
                    <span className="text-right text-xs text-gray-600 dark:text-gray-400">
                      {formatPrice(p.gia_binh_quan)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
