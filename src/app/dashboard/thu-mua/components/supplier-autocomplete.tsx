"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SupplierOption {
  id: string;
  ma_ncc: string;
  ten_ncc: string;
}

interface SupplierAutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (ncc: { id: string; ma_ncc: string; ten_ncc: string }) => void;
  selected?: boolean;
  placeholder?: string;
}

export default function SupplierAutocomplete({
  value,
  onChange,
  onSelect,
  selected,
  placeholder = "Tìm NCC theo mã hoặc tên...",
}: SupplierAutocompleteProps) {
  const [options, setOptions] = useState<SupplierOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuppliers = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = query.trim()
        ? `search=${encodeURIComponent(query)}&limit=50`
        : `limit=50`;
      const res = await fetch(`/api/wms/nha-cung-cap?${params}`);
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
    debounceRef.current = setTimeout(() => {
      fetchSuppliers(value);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuppliers]);

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

  function handleSelect(ncc: SupplierOption) {
    onSelect({ id: ncc.id, ma_ncc: ncc.ma_ncc, ten_ncc: ncc.ten_ncc });
    onChange(ncc.ten_ncc);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (options.length > 0) setOpen(true);
            else fetchSuppliers(value).then(() => setOpen(true));
          }}
          placeholder={placeholder}
          className={`w-full rounded border px-3 py-1.5 pr-8 text-sm transition-colors ${
            selected
              ? "border-green-500 bg-green-50 dark:border-green-700 dark:bg-green-950/30"
              : "border-gray-300 dark:border-gray-700 dark:bg-gray-900"
          } focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        {selected && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </div>

      {open && (
        <div className="absolute bottom-full z-50 mb-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
          {loading ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Đang tìm...
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">
              Không tìm thấy NCC
            </div>
          ) : (
            options.map((ncc) => (
              <button
                key={ncc.id}
                type="button"
                onClick={() => handleSelect(ncc)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-800"
              >
                <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  {ncc.ma_ncc}
                </span>
                <span className="truncate text-gray-900 dark:text-gray-100">
                  {ncc.ten_ncc}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
