"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { PhieuDatHang, TrangThaiDatHang, KhoHang } from "@/types/wms";
import type { OcrInvoiceItem } from "@/types/ocr";
import SupplierAutocomplete from "../components/supplier-autocomplete";
import ProductAutocomplete from "../components/product-autocomplete";
import PODetailModal from "../components/po-detail-modal";

const TRANG_THAI_LABELS: Record<string, string> = {
  cho_xac_nhan: "Cho xac nhan",
  da_xac_nhan: "Da xac nhan",
  dang_giao: "Dang giao",
  da_nhan_hang: "Da nhan hang",
  da_thanh_toan: "Da thanh toan",
  huy: "Huy",
};

const STATUS_COLORS: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  cho_xac_nhan: {
    text: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-300",
  },
  da_xac_nhan: {
    text: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-300",
  },
  dang_giao: {
    text: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-300",
  },
  da_nhan_hang: {
    text: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-300",
  },
  da_thanh_toan: {
    text: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-300",
  },
  huy: {
    text: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-300",
  },
};

interface FormItem {
  uid: string;
  hang_hoa_id: string | null;
  ten_hang_hoa: string;
  don_vi_tinh: string;
  so_luong: number;
  don_gia: number;
  vat_pct: number;
  ncc_id: string;
  ncc_ma: string;
  ncc_ten: string;
  ghi_chu: string;
  productSearch: string;
  nccSearch: string;
  nccSelected: boolean;
}

function createEmptyItem(): FormItem {
  return {
    uid: crypto.randomUUID(),
    hang_hoa_id: null,
    ten_hang_hoa: "",
    don_vi_tinh: "",
    so_luong: 0,
    don_gia: 0,
    vat_pct: 0,
    ncc_id: "",
    ncc_ma: "",
    ncc_ten: "",
    ghi_chu: "",
    productSearch: "",
    nccSearch: "",
    nccSelected: false,
  };
}

function generatePOCode(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0");
  return `PO-${yy}${mm}-${seq}`;
}

const PAGE_SIZE = 20;

export default function CongNoTab() {
  // List state
  const [orders, setOrders] = useState<PhieuDatHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formItems, setFormItems] = useState<FormItem[]>([createEmptyItem()]);
  const [formNgayDat, setFormNgayDat] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formNgayGiao, setFormNgayGiao] = useState("");
  const [formGhiChu, setFormGhiChu] = useState("");
  const [formSoPO] = useState(generatePOCode);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<PhieuDatHang | null>(null);

  // Kho selection dialog for da_nhan_hang
  const [khoDialog, setKhoDialog] = useState<{
    orderId: string;
    newStatus: TrangThaiDatHang;
  } | null>(null);
  const [khoList, setKhoList] = useState<KhoHang[]>([]);
  const [selectedKho, setSelectedKho] = useState("");
  const [loadingKho, setLoadingKho] = useState(false);

  // Delete all state
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (search) params.set("search", search);
      if (filterStatus) params.set("trang_thai", filterStatus);

      const res = await fetch(`/api/wms/phieu-dat-hang?${params.toString()}`);
      if (!res.ok) throw new Error("Loi tai danh sach phieu dat hang");
      const data = await res.json();
      setOrders(data?.data || []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Loi tai du lieu");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  function formatMoney(n: number): string {
    return n.toLocaleString("vi-VN");
  }

  // Form calculations
  const formTotals = useMemo(() => {
    let subtotal = 0;
    let vatAmt = 0;
    for (const item of formItems) {
      const lineSub = item.so_luong * item.don_gia;
      subtotal += lineSub;
      vatAmt += lineSub * (item.vat_pct / 100);
    }
    return { subtotal, vatAmt, total: subtotal + vatAmt };
  }, [formItems]);

  // Group items by NCC
  const nccGroups = useMemo(() => {
    const groups: Record<
      string,
      { ncc_id: string; ncc_ma: string; ncc_ten: string; items: FormItem[] }
    > = {};
    for (const item of formItems) {
      if (!item.ncc_id) continue;
      if (!groups[item.ncc_id]) {
        groups[item.ncc_id] = {
          ncc_id: item.ncc_id,
          ncc_ma: item.ncc_ma,
          ncc_ten: item.ncc_ten,
          items: [],
        };
      }
      groups[item.ncc_id].items.push(item);
    }
    return groups;
  }, [formItems]);

  const nccGroupCount = Object.keys(nccGroups).length;

  function updateFormItem(
    uid: string,
    field: keyof FormItem,
    value: string | number | boolean | null
  ) {
    setFormItems((prev) =>
      prev.map((item) =>
        item.uid === uid ? { ...item, [field]: value } : item
      )
    );
  }

  function removeFormItem(uid: string) {
    setFormItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.uid !== uid);
    });
  }

  function addFormItem() {
    setFormItems((prev) => [...prev, createEmptyItem()]);
  }

  function resetForm() {
    setFormItems([createEmptyItem()]);
    setFormNgayDat(new Date().toISOString().slice(0, 10));
    setFormNgayGiao("");
    setFormGhiChu("");
    setSubmitError("");
    setOcrError("");
    setOcrPreviewUrl(null);
  }

  async function handleOcrUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setOcrError("Vui long chon file anh (JPEG, PNG, WebP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setOcrError("File qua lon. Gioi han 5MB.");
      return;
    }

    setOcrLoading(true);
    setOcrError("");

    const previewUrl = URL.createObjectURL(file);
    setOcrPreviewUrl(previewUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/wms/ocr-invoice", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Loi OCR");
      }

      const result = await res.json();

      // Auto-fill form items from OCR result
      const newItems: FormItem[] = (result.items || []).map(
        (item: OcrInvoiceItem) => ({
          uid: crypto.randomUUID(),
          hang_hoa_id: item.matched_hang_hoa_id || null,
          ten_hang_hoa: item.matched_ten || item.ocr_ten_hang_hoa,
          don_vi_tinh: item.matched_dvt || item.don_vi_tinh || "",
          so_luong: item.so_luong || 0,
          don_gia: item.don_gia || 0,
          vat_pct: item.vat_pct || 0,
          ncc_id: result.supplier?.matched_id || "",
          ncc_ma: result.supplier?.matched_ma_ncc || "",
          ncc_ten:
            result.supplier?.matched_ten_ncc ||
            result.supplier?.ocr_ten_ncc ||
            "",
          ghi_chu: "",
          productSearch: item.matched_ten || item.ocr_ten_hang_hoa,
          nccSearch:
            result.supplier?.matched_ten_ncc ||
            result.supplier?.ocr_ten_ncc ||
            "",
          nccSelected: !!result.supplier?.matched_id,
        })
      );

      if (newItems.length > 0) {
        setFormItems(newItems);
      }

      // Show confidence notice
      if (result.confidence === "low") {
        setOcrError(
          "Luu y: Do chinh xac thap. Vui long kiem tra ky cac dong hang."
        );
      } else if (result.notes) {
        setOcrError(`Ghi chu OCR: ${result.notes}`);
      }
    } catch (err) {
      setOcrError(
        err instanceof Error ? err.message : "Loi xu ly anh hoa don"
      );
    } finally {
      setOcrLoading(false);
      if (ocrInputRef.current) ocrInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    // Validate at least one item with NCC
    const validItems = formItems.filter(
      (item) => item.ncc_id && item.ten_hang_hoa && item.so_luong > 0
    );
    if (validItems.length === 0) {
      setSubmitError(
        "Can it nhat 1 dong hang hoa co NCC, ten hang va so luong."
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      // Group by NCC and POST each group
      const groups: Record<string, FormItem[]> = {};
      for (const item of validItems) {
        if (!groups[item.ncc_id]) groups[item.ncc_id] = [];
        groups[item.ncc_id].push(item);
      }

      const results: string[] = [];
      for (const [nccId, items] of Object.entries(groups)) {
        const body = {
          ncc_id: nccId,
          ngay_dat: formNgayDat,
          ngay_giao: formNgayGiao || null,
          ghi_chu: formGhiChu || null,
          items: items.map((item) => ({
            hang_hoa_id: item.hang_hoa_id || null,
            ten_hang_hoa: item.ten_hang_hoa,
            don_vi_tinh: item.don_vi_tinh || null,
            so_luong: item.so_luong,
            don_gia: item.don_gia,
            vat_pct: item.vat_pct,
            ghi_chu: item.ghi_chu || null,
          })),
        };

        const res = await fetch("/api/wms/phieu-dat-hang", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Loi tao phieu dat hang");
        }

        const result = await res.json();
        results.push(result.ma_phieu);
      }

      // Success
      resetForm();
      setShowForm(false);
      setPage(1);
      fetchOrders();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Loi tao phieu");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    orderId: string,
    newStatus: TrangThaiDatHang
  ) {
    // If changing to da_nhan_hang, need kho selection
    if (newStatus === "da_nhan_hang") {
      setKhoDialog({ orderId, newStatus });
      setLoadingKho(true);
      try {
        const res = await fetch("/api/wms/kho");
        if (res.ok) {
          const data = await res.json();
          setKhoList(data?.data || data || []);
        }
      } catch {
        setKhoList([]);
      } finally {
        setLoadingKho(false);
      }
      return;
    }

    // Otherwise update directly
    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trang_thai: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Loi cap nhat trang thai");
        return;
      }

      fetchOrders();
    } catch {
      alert("Loi ket noi server");
    }
  }

  async function confirmKhoAndUpdateStatus() {
    if (!khoDialog || !selectedKho) return;

    try {
      const res = await fetch(
        `/api/wms/phieu-dat-hang/${khoDialog.orderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trang_thai: khoDialog.newStatus,
            kho_id: selectedKho,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Loi cap nhat trang thai");
        return;
      }

      setKhoDialog(null);
      setSelectedKho("");
      fetchOrders();
    } catch {
      alert("Loi ket noi server");
    }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!confirm("Ban chac chan muon xoa phieu dat hang nay?")) return;

    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${orderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Loi xoa phieu");
        return;
      }

      fetchOrders();
    } catch {
      alert("Loi ket noi server");
    }
  }

  async function handleDeleteAll() {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }

    setDeletingAll(true);
    try {
      // Delete each order one by one
      for (const order of orders) {
        await fetch(`/api/wms/phieu-dat-hang/${order.id}`, {
          method: "DELETE",
        });
      }

      setConfirmDeleteAll(false);
      setPage(1);
      fetchOrders();
    } catch {
      alert("Loi xoa du lieu");
    } finally {
      setDeletingAll(false);
    }
  }

  async function handleViewDetail(orderId: string) {
    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${orderId}`);
      if (!res.ok) throw new Error("Loi tai chi tiet");
      const data = await res.json();
      // Map items from phieu_dat_hang_items to items
      if (data.phieu_dat_hang_items) {
        data.items = data.phieu_dat_hang_items;
      }
      setSelectedOrder(data);
    } catch {
      alert("Khong the tai chi tiet don hang");
    }
  }

  async function handleSaveDetail(updated: PhieuDatHang) {
    try {
      const res = await fetch(`/api/wms/phieu-dat-hang/${updated.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trang_thai: updated.trang_thai,
          ngay_dat: updated.ngay_dat,
          ngay_giao: updated.ngay_giao,
          ghi_chu: updated.ghi_chu,
          so_hoa_don: updated.so_hoa_don,
          tong_tien_hoa_don: updated.tong_tien_hoa_don,
          items: updated.items?.map((item) => ({
            hang_hoa_id: item.hang_hoa_id || null,
            ten_hang_hoa: item.ten_hang_hoa,
            don_vi_tinh: item.don_vi_tinh || null,
            so_luong: item.so_luong,
            don_gia: item.don_gia,
            vat_pct: item.vat_pct || 0,
            ghi_chu: item.ghi_chu || null,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Loi luu thay doi");
        return;
      }

      setSelectedOrder(null);
      fetchOrders();
    } catch {
      alert("Loi ket noi server");
    }
  }

  // Stats for header
  const totalValue = orders.reduce((sum, o) => sum + (o.tong_tien || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bang Cong No Don Le
          </h2>
          <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
            <span>
              Tong don:{" "}
              <strong className="text-gray-900 dark:text-white">
                {total}
              </strong>
            </span>
            <span>
              Tong gia tri:{" "}
              <strong className="text-blue-600 dark:text-blue-400">
                {formatMoney(totalValue)}
              </strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
              showForm
                ? "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {showForm ? "Dong form" : "+ Nhap don hang"}
          </button>
          {confirmDeleteAll ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Xac nhan xoa tat ca?</span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="rounded bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAll ? "Dang xoa..." : "Xac nhan"}
              </button>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="rounded border border-gray-300 px-3 py-2 text-xs dark:border-gray-600"
              >
                Huy
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteAll(true)}
              className="rounded border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950"
            >
              Xoa tat ca
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tim theo so PO, ma NCC, ten NCC..."
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <option value="">Tat ca trang thai</option>
          {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          {/* Form header */}
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                So PO (tu dong)
              </label>
              <input
                type="text"
                value={formSoPO}
                readOnly
                className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-1.5 font-mono text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngay dat
              </label>
              <input
                type="date"
                value={formNgayDat}
                onChange={(e) => setFormNgayDat(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Ngay giao du kien
              </label>
              <input
                type="date"
                value={formNgayGiao}
                onChange={(e) => setFormNgayGiao(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>

          {/* Items table */}
          <div className="mb-4 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-500">
                    STT
                  </th>
                  <th className="min-w-[200px] px-2 py-2 text-left font-medium text-gray-500">
                    Ten hang hoa
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500">
                    DVT
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    SL
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Don gia
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    VAT%
                  </th>
                  <th className="px-2 py-2 text-right font-medium text-gray-500">
                    Thanh tien
                  </th>
                  <th className="min-w-[180px] px-2 py-2 text-left font-medium text-gray-500">
                    NCC
                  </th>
                  <th className="px-2 py-2 text-left font-medium text-gray-500">
                    Ghi chu
                  </th>
                  <th className="px-2 py-2 text-center font-medium text-gray-500">
                    Xoa
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {formItems.map((item, idx) => {
                  const lineSub = item.so_luong * item.don_gia;
                  const lineTotal = lineSub * (1 + item.vat_pct / 100);
                  return (
                    <tr
                      key={item.uid}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-2 py-2">
                        <ProductAutocomplete
                          value={item.productSearch || item.ten_hang_hoa}
                          onChange={(v) =>
                            updateFormItem(item.uid, "productSearch", v)
                          }
                          onSelect={(product) => {
                            updateFormItem(
                              item.uid,
                              "hang_hoa_id",
                              product.id
                            );
                            updateFormItem(
                              item.uid,
                              "ten_hang_hoa",
                              product.ten
                            );
                            updateFormItem(
                              item.uid,
                              "productSearch",
                              product.ten
                            );
                            updateFormItem(
                              item.uid,
                              "don_vi_tinh",
                              product.don_vi_tinh?.ten_dvt || ""
                            );
                            if (product.gia_binh_quan > 0 && item.don_gia === 0) {
                              updateFormItem(
                                item.uid,
                                "don_gia",
                                product.gia_binh_quan
                              );
                            }
                          }}
                          placeholder="Tim hang hoa..."
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.don_vi_tinh}
                          onChange={(e) =>
                            updateFormItem(
                              item.uid,
                              "don_vi_tinh",
                              e.target.value
                            )
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.so_luong || ""}
                          onChange={(e) =>
                            updateFormItem(
                              item.uid,
                              "so_luong",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          value={item.don_gia || ""}
                          onChange={(e) =>
                            updateFormItem(
                              item.uid,
                              "don_gia",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.vat_pct || ""}
                          onChange={(e) =>
                            updateFormItem(
                              item.uid,
                              "vat_pct",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-16 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2 text-right font-medium">
                        {formatMoney(lineTotal)}
                      </td>
                      <td className="px-2 py-2">
                        <SupplierAutocomplete
                          value={item.nccSearch || item.ncc_ten}
                          onChange={(v) => {
                            updateFormItem(item.uid, "nccSearch", v);
                            if (item.nccSelected) {
                              updateFormItem(item.uid, "nccSelected", false);
                              updateFormItem(item.uid, "ncc_id", "");
                              updateFormItem(item.uid, "ncc_ma", "");
                              updateFormItem(item.uid, "ncc_ten", "");
                            }
                          }}
                          onSelect={(ncc) => {
                            updateFormItem(item.uid, "ncc_id", ncc.id);
                            updateFormItem(item.uid, "ncc_ma", ncc.ma_ncc);
                            updateFormItem(item.uid, "ncc_ten", ncc.ten_ncc);
                            updateFormItem(item.uid, "nccSearch", ncc.ten_ncc);
                            updateFormItem(item.uid, "nccSelected", true);
                          }}
                          selected={item.nccSelected}
                          placeholder="Tim NCC..."
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.ghi_chu}
                          onChange={(e) =>
                            updateFormItem(
                              item.uid,
                              "ghi_chu",
                              e.target.value
                            )
                          }
                          className="w-28 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
                          placeholder="Ghi chu"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeFormItem(item.uid)}
                          disabled={formItems.length <= 1}
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-950"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add row + OCR upload buttons */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addFormItem}
              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              + Them dong
            </button>

            {/* OCR Upload */}
            <input
              ref={ocrInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOcrUpload(file);
              }}
            />
            <button
              type="button"
              onClick={() => ocrInputRef.current?.click()}
              disabled={ocrLoading}
              className="flex items-center gap-1.5 rounded border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:hover:bg-purple-900"
            >
              {ocrLoading ? (
                <>
                  <svg
                    className="h-3.5 w-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Dang doc hoa don...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Nhap tu anh hoa don
                </>
              )}
            </button>
          </div>

          {/* OCR error/info */}
          {ocrError && (
            <div className="mb-4 rounded border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
              {ocrError}
            </div>
          )}

          {/* OCR preview */}
          {ocrPreviewUrl && (
            <div className="mb-4 flex items-start gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ocrPreviewUrl}
                alt="Anh hoa don"
                className="h-24 w-auto rounded border border-gray-200 object-contain dark:border-gray-700"
              />
              <button
                type="button"
                onClick={() => {
                  setOcrPreviewUrl(null);
                  setOcrError("");
                }}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Xoa anh
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="mb-4 flex justify-end">
            <div className="w-72 space-y-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tong cong:</span>
                <span>{formatMoney(formTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">VAT:</span>
                <span>{formatMoney(formTotals.vatAmt)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold dark:border-gray-700">
                <span>Tong thanh toan:</span>
                <span className="text-blue-600 dark:text-blue-400">
                  {formatMoney(formTotals.total)}
                </span>
              </div>
            </div>
          </div>

          {/* NCC group notice */}
          {nccGroupCount > 1 && (
            <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-800 dark:bg-orange-950">
              <span className="font-medium text-orange-700 dark:text-orange-300">
                Se tach thanh {nccGroupCount} phieu:{" "}
              </span>
              <span className="text-orange-600 dark:text-orange-400">
                {Object.values(nccGroups)
                  .map((g) => `${g.ncc_ten} (${g.items.length} dong)`)
                  .join(", ")}
              </span>
            </div>
          )}

          {/* Ghi chu */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Ghi chu
            </label>
            <textarea
              value={formGhiChu}
              onChange={(e) => setFormGhiChu(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Ghi chu phieu dat hang..."
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950">
              {submitError}
            </div>
          )}

          {/* Form actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950"
            >
              Xoa
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Huy
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Dang luu..."
                : nccGroupCount > 1
                  ? `Luu & Tach ${nccGroupCount} phieu`
                  : "Luu phieu dat hang"}
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950">
          {error}
        </div>
      )}

      {/* PO list table */}
      <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                So PO
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ngay dat
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ngay giao
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ma NCC
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ten cong ty
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                Tong tien
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                Trang thai
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                Thao tac
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-gray-400">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Dang tai...
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  Chua co phieu dat hang nao
                </td>
              </tr>
            ) : (
              <>
                {orders.map((order) => {
                  const sc = STATUS_COLORS[order.trang_thai] || {
                    text: "text-gray-600",
                    bg: "bg-gray-50 dark:bg-gray-900",
                    border: "border-gray-300",
                  };
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs font-medium text-blue-600 dark:text-blue-400">
                          {order.ma_phieu}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {order.ngay_dat
                          ? new Date(order.ngay_dat).toLocaleDateString("vi-VN")
                          : "--"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {order.ngay_giao
                          ? new Date(order.ngay_giao).toLocaleDateString(
                              "vi-VN"
                            )
                          : "--"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-gray-500">
                          {order.nha_cung_cap?.ma_ncc || "--"}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                        {order.nha_cung_cap?.ten_ncc || "--"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatMoney(order.tong_tien)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={order.trang_thai}
                          onChange={(e) =>
                            handleStatusChange(
                              order.id,
                              e.target.value as TrangThaiDatHang
                            )
                          }
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sc.text} ${sc.bg} ${sc.border} cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        >
                          {Object.entries(TRANG_THAI_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleViewDetail(order.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                          >
                            Xem
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            Xoa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Footer total row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium dark:border-gray-700 dark:bg-gray-900">
                  <td
                    colSpan={5}
                    className="px-3 py-2 text-right text-gray-500"
                  >
                    Tong trang nay:
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-blue-600 dark:text-blue-400">
                    {formatMoney(totalValue)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Trang {page}/{totalPages} ({total} phieu)
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-gray-700"
            >
              Truoc
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`rounded px-3 py-1.5 text-xs ${
                    pageNum === page
                      ? "bg-blue-600 font-medium text-white"
                      : "border border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-gray-700"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* PO Detail Modal */}
      {selectedOrder && (
        <PODetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onSave={handleSaveDetail}
        />
      )}

      {/* Kho Selection Dialog */}
      {khoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-950">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Chon kho nhan hang
            </h3>
            <p className="mb-4 text-sm text-gray-500">
              Khi chuyen trang thai sang &quot;Da nhan hang&quot;, he thong se tu
              dong tao phieu nhap kho. Vui long chon kho nhan.
            </p>

            {loadingKho ? (
              <div className="flex items-center justify-center py-6 text-gray-400">
                <svg
                  className="mr-2 h-5 w-5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Dang tai danh sach kho...
              </div>
            ) : khoList.length === 0 ? (
              <p className="py-4 text-center text-sm text-red-500">
                Khong tim thay kho nao. Vui long tao kho truoc.
              </p>
            ) : (
              <select
                value={selectedKho}
                onChange={(e) => setSelectedKho(e.target.value)}
                className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">-- Chon kho --</option>
                {khoList.map((kho) => (
                  <option key={kho.id} value={kho.id}>
                    {kho.ma_kho} - {kho.ten_kho}
                  </option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setKhoDialog(null);
                  setSelectedKho("");
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Huy
              </button>
              <button
                onClick={confirmKhoAndUpdateStatus}
                disabled={!selectedKho}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Xac nhan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
