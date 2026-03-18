"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { KhoHang, HangHoa, DonViTinh, PhanLoaiHH, NhaCungCap } from "@/types/wms";

const subTabs = [
  { id: "hang-hoa", label: "Hàng hóa" },
  { id: "nha-cung-cap", label: "Nhà cung cấp" },
  { id: "kho", label: "Kho hàng" },
  { id: "don-vi-tinh", label: "Đơn vị tính" },
  { id: "phan-loai", label: "Phân loại" },
];

const NHIET_DO_LABEL: Record<string, string> = {
  thuong: "Thường",
  mat: "Mát (2-8°C)",
  lanh: "Lạnh (0-2°C)",
  dong: "Đông (<-18°C)",
};

export default function DanhMucTab() {
  const [activeSubTab, setActiveSubTab] = useState("hang-hoa");

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              activeSubTab === tab.id
                ? "border-blue-600 font-medium text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "hang-hoa" && <HangHoaSubTab />}
      {activeSubTab === "nha-cung-cap" && <NhaCungCapSubTab />}
      {activeSubTab === "kho" && <KhoSubTab />}
      {activeSubTab === "don-vi-tinh" && <DonViTinhSubTab />}
      {activeSubTab === "phan-loai" && <PhanLoaiSubTab />}
    </div>
  );
}

// ==================== IMPORT COMPONENT ====================
interface DuplicateInfo {
  has_duplicates: boolean;
  duplicate_count: number;
  duplicates: string[];
  new_count: number;
  total: number;
}

interface ImportResult {
  success?: boolean;
  has_duplicates?: boolean;
  total?: number;
  inserted?: number;
  skipped?: number;
  overwritten?: number;
  duplicate_count?: number;
  duplicates?: string[];
  new_count?: number;
  errors?: string[];
}

function ImportExcelButton({ type, onDone }: { type: "nha_cung_cap" | "hang_hoa"; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);

  async function doImport(file: File, duplicateMode: string) {
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("duplicate_mode", duplicateMode);

    try {
      const res = await fetch("/api/wms/import", { method: "POST", body: formData });
      const data: ImportResult = await res.json();

      if (data.has_duplicates && duplicateMode === "check") {
        // Show duplicate popup
        setDuplicateInfo({
          has_duplicates: true,
          duplicate_count: data.duplicate_count || 0,
          duplicates: data.duplicates || [],
          new_count: data.new_count || 0,
          total: data.total || 0,
        });
        setPendingFile(file);
        setImporting(false);
        return;
      }

      setResult(data);
      if (data.success) onDone();
    } catch {
      setResult({ success: false, errors: ["Lỗi kết nối server"] });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDuplicateInfo(null);
    setPendingFile(null);
    await doImport(file, "check");
  }

  async function handleDuplicateChoice(mode: "skip" | "overwrite") {
    if (!pendingFile) return;
    setDuplicateInfo(null);
    await doImport(pendingFile, mode);
    setPendingFile(null);
  }

  function handleCancel() {
    setDuplicateInfo(null);
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const label = type === "nha_cung_cap" ? "NCC" : "hàng hóa";

  return (
    <div className="inline-flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="rounded border border-green-600 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-950"
      >
        {importing ? "Đang import..." : "Import Excel"}
      </button>
      {result && (
        <span className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}>
          {result.success
            ? `Thành công: ${result.inserted} mới${result.overwritten ? `, ${result.overwritten} cập nhật` : ""}${result.skipped ? `, ${result.skipped} bỏ qua` : ""} / ${result.total} dòng`
            : result.errors?.[0] || "Lỗi"}
          {result.errors && result.errors.length > 0 && (
            <span className="ml-1 text-red-500">({result.errors.join("; ")})</span>
          )}
        </span>
      )}

      {/* Duplicate confirmation popup */}
      {duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-lg font-semibold text-orange-600">
              Phát hiện {duplicateInfo.duplicate_count} {label} trùng mã
            </h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              File có <strong>{duplicateInfo.total}</strong> dòng, trong đó <strong className="text-orange-600">{duplicateInfo.duplicate_count}</strong> mã đã tồn tại
              và <strong className="text-green-600">{duplicateInfo.new_count}</strong> mã mới.
            </p>

            {duplicateInfo.duplicates.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-1 text-xs font-medium text-gray-500">Danh sách trùng (tối đa 20):</p>
                {duplicateInfo.duplicates.map((d, i) => (
                  <p key={i} className="truncate text-xs text-gray-600 dark:text-gray-400">{d}</p>
                ))}
              </div>
            )}

            <p className="mb-4 text-sm font-medium">Bạn muốn xử lý như thế nào?</p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => handleDuplicateChoice("skip")}
                disabled={importing}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? "Đang xử lý..." : `Bỏ qua trùng (chỉ thêm ${duplicateInfo.new_count} mới)`}
              </button>
              <button
                onClick={() => handleDuplicateChoice("overwrite")}
                disabled={importing}
                className="flex-1 rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {importing ? "Đang xử lý..." : `Ghi đè tất cả (${duplicateInfo.total} dòng)`}
              </button>
              <button
                onClick={handleCancel}
                disabled={importing}
                className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HÀNG HÓA ====================
const PAGE_SIZE = 50;

function HangHoaSubTab() {
  const [list, setList] = useState<HangHoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [dvtList, setDvtList] = useState<DonViTinh[]>([]);
  const [plList, setPlList] = useState<PhanLoaiHH[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Form
  const [fMa, setFMa] = useState("");
  const [fTen, setFTen] = useState("");
  const [fDvt, setFDvt] = useState("");
  const [fPL, setFPL] = useState("");
  const [fNhietDo, setFNhietDo] = useState("thuong");
  const [fPPXuat, setFPPXuat] = useState("FIFO");
  const [fTonMin, setFTonMin] = useState("");
  const [fTonMax, setFTonMax] = useState("");
  const [fHSD, setFHSD] = useState("");
  const [fNguonGoc, setFNguonGoc] = useState("");
  const [fGiaMua, setFGiaMua] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    const res = await fetch(`/api/wms/hang-hoa?${params}`);
    const data = await res.json();
    setList(data?.data || (Array.isArray(data) ? data : []));
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    fetchList();
    fetch("/api/wms/don-vi-tinh").then((r) => r.json()).then((d) => Array.isArray(d) && setDvtList(d));
    fetch("/api/wms/phan-loai").then((r) => r.json()).then((d) => Array.isArray(d) && setPlList(d));
  }, [fetchList]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/wms/hang-hoa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ma_hang_hoa: fMa,
        ten: fTen,
        dvt_id: fDvt || null,
        phan_loai_id: fPL || null,
        nhiet_do_bao_quan: fNhietDo,
        phuong_phap_xuat: fPPXuat,
        ton_toi_thieu: parseFloat(fTonMin) || 0,
        ton_toi_da: parseFloat(fTonMax) || 0,
        han_su_dung_ngay: parseInt(fHSD) || null,
        nguon_goc: fNguonGoc || null,
        gia_binh_quan: parseFloat(fGiaMua) || 0,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Lỗi tạo hàng hóa");
      setSubmitting(false);
      return;
    }

    setShowForm(false);
    setFMa(""); setFTen(""); setFDvt(""); setFPL(""); setFNguonGoc(""); setFGiaMua("");
    setSubmitting(false);
    fetchList();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input type="text" placeholder="Tìm mã, tên hàng hóa..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-60 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
        <div className="flex gap-2">
          <ImportExcelButton type="hang_hoa" onDone={fetchList} />
          <button onClick={() => setShowForm(!showForm)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Thêm hàng hóa
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Mã hàng hóa *</label>
              <input required value={fMa} onChange={(e) => setFMa(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="B0001" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Tên *</label>
              <input required value={fTen} onChange={(e) => setFTen(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="Dầu Cái Lân 1can/25kg" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Đơn vị tính</label>
              <select value={fDvt} onChange={(e) => setFDvt(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="">— Chọn —</option>
                {dvtList.map((d) => <option key={d.id} value={d.id}>{d.ten_dvt}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nhóm VTHH</label>
              <select value={fPL} onChange={(e) => setFPL(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="">— Chọn —</option>
                {plList.map((p) => <option key={p.id} value={p.id}>{p.ten_phan_loai}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nguồn gốc</label>
              <input value={fNguonGoc} onChange={(e) => setFNguonGoc(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="Việt Nam" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Nhiệt độ BQ</label>
              <select value={fNhietDo} onChange={(e) => setFNhietDo(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                {Object.entries(NHIET_DO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">PP xuất kho</label>
              <select value={fPPXuat} onChange={(e) => setFPPXuat(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="FIFO">FIFO (nhập trước xuất trước)</option>
                <option value="FEFO">FEFO (hết HSD trước xuất trước)</option>
                <option value="chi_dinh">Chỉ định lô</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">HSD (ngày)</label>
              <input type="number" min="0" value={fHSD} onChange={(e) => setFHSD(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="VD: 90" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Đơn giá mua gần nhất</label>
              <input type="number" min="0" value={fGiaMua} onChange={(e) => setFGiaMua(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="37120" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tồn tối thiểu</label>
              <input type="number" min="0" value={fTonMin} onChange={(e) => setFTonMin(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tồn tối đa</label>
              <input type="number" min="0" value={fTonMax} onChange={(e) => setFTonMax(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Đang lưu..." : "Tạo hàng hóa"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Hủy</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Mã</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Tên</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Tính chất</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Nhóm VTHH</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Đơn vị tính chính</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Thời hạn bảo hành</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Nguồn gốc</th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">Đơn giá mua gần nhất</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Chưa có hàng hóa</td></tr>
            ) : (
              list.map((hh) => (
                <tr key={hh.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-3 py-2 font-mono text-xs">{hh.ma_hang_hoa}</td>
                  <td className="max-w-[200px] truncate px-3 py-2">{hh.ten}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{hh.quy_cach || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{hh.phan_loai?.ten_phan_loai || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{hh.don_vi_tinh?.ten_dvt || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{hh.han_su_dung_ngay ? `${hh.han_su_dung_ngay} ngày` : "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{hh.nguon_goc || "—"}</td>
                  <td className="px-3 py-2 text-right">{Number(hh.gia_binh_quan) > 0 ? Number(hh.gia_binh_quan).toLocaleString("vi-VN") : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total.toLocaleString("vi-VN")} hàng hóa
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              ««
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              «
            </button>
            <span className="px-3 py-1 text-xs font-medium">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              »
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== NHÀ CUNG CẤP ====================
function NhaCungCapSubTab() {
  const [list, setList] = useState<NhaCungCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const [fMa, setFMa] = useState("");
  const [fTen, setFTen] = useState("");
  const [fDiaChi, setFDiaChi] = useState("");
  const [fMST, setFMST] = useState("");
  const [fSDT, setFSDT] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fNguoiLH, setFNguoiLH] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    const res = await fetch(`/api/wms/nha-cung-cap?${params}`);
    const data = await res.json();
    setList(data?.data || (Array.isArray(data) ? data : []));
    setTotal(data?.total ?? 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/wms/nha-cung-cap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ma_ncc: fMa, ten_ncc: fTen, dia_chi: fDiaChi || null,
        ma_so_thue: fMST || null, dien_thoai: fSDT || null,
        email: fEmail || null, nguoi_lien_he: fNguoiLH || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Lỗi tạo nhà cung cấp");
      setSubmitting(false);
      return;
    }

    setShowForm(false);
    setFMa(""); setFTen(""); setFDiaChi(""); setFMST(""); setFSDT(""); setFEmail(""); setFNguoiLH("");
    setSubmitting(false);
    fetchList();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input type="text" placeholder="Tìm mã, tên NCC, MST..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-60 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
        <div className="flex gap-2">
          {total > 0 && (
            <button
              onClick={async () => {
                if (!confirm(`Xóa tất cả ${total} NCC? Hành động này không thể hoàn tác!`)) return;
                setDeleting(true);
                await fetch("/api/wms/nha-cung-cap?action=delete_all", { method: "DELETE" });
                setDeleting(false);
                fetchList();
              }}
              disabled={deleting}
              className="rounded border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
            >
              {deleting ? "Đang xóa..." : `Xóa tất cả (${total})`}
            </button>
          )}
          <ImportExcelButton type="nha_cung_cap" onDone={fetchList} />
          <button onClick={() => setShowForm(!showForm)}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Thêm NCC
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Mã NCC *</label>
              <input required value={fMa} onChange={(e) => setFMa(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="NC00128" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Tên nhà cung cấp *</label>
              <input required value={fTen} onChange={(e) => setFTen(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="CÔNG TY TNHH..." />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Địa chỉ</label>
              <input value={fDiaChi} onChange={(e) => setFDiaChi(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Mã số thuế / CCCD</label>
              <input value={fMST} onChange={(e) => setFMST(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="0315138097" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Điện thoại</label>
              <input value={fSDT} onChange={(e) => setFSDT(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Email</label>
              <input type="email" value={fEmail} onChange={(e) => setFEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Người liên hệ</label>
              <input value={fNguoiLH} onChange={(e) => setFNguoiLH(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Đang lưu..." : "Tạo NCC"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Hủy</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Mã NCC</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Tên nhà cung cấp</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">Địa chỉ</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">MST/CCCD</th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">SĐT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có nhà cung cấp</td></tr>
            ) : (
              list.map((ncc) => (
                <tr key={ncc.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-3 py-2 font-mono text-xs">{ncc.ma_ncc}</td>
                  <td className="max-w-[250px] truncate px-3 py-2">{ncc.ten_ncc}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-gray-500">{ncc.dia_chi || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{ncc.ma_so_thue || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{ncc.dien_thoai || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Hiển thị {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total.toLocaleString("vi-VN")} nhà cung cấp
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              ««
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              «
            </button>
            <span className="px-3 py-1 text-xs font-medium">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              »
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== KHO HÀNG ====================
function KhoSubTab() {
  const [list, setList] = useState<KhoHang[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fMa, setFMa] = useState("");
  const [fTen, setFTen] = useState("");
  const [fLoai, setFLoai] = useState("cua_hang");
  const [fDiaChi, setFDiaChi] = useState("");
  const [fSDT, setFSDT] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchList = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/wms/kho");
    const data = await res.json();
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/wms/kho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ma_kho: fMa, ten_kho: fTen, loai_kho: fLoai, dia_chi: fDiaChi, dien_thoai: fSDT }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Lỗi");
      setSubmitting(false);
      return;
    }
    setShowForm(false);
    setFMa(""); setFTen(""); setFDiaChi(""); setFSDT("");
    setSubmitting(false);
    fetchList();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">+ Thêm kho</button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
          {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Mã kho *</label>
              <input required value={fMa} onChange={(e) => setFMa(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="KHO-CH01" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tên kho *</label>
              <input required value={fTen} onChange={(e) => setFTen(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" placeholder="Kho Cửa hàng 01" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Loại kho</label>
              <select value={fLoai} onChange={(e) => setFLoai(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                <option value="trung_tam">Kho trung tâm</option>
                <option value="cua_hang">Kho cửa hàng</option>
                <option value="tam">Kho tạm</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">Địa chỉ</label>
              <input value={fDiaChi} onChange={(e) => setFDiaChi(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">SĐT</label>
              <input value={fSDT} onChange={(e) => setFSDT(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Đang lưu..." : "Tạo kho"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Hủy</button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="col-span-full py-6 text-center text-gray-400">Đang tải...</p> : list.length === 0 ? (
          <p className="col-span-full py-6 text-center text-gray-400">Chưa có kho nào</p>
        ) : list.map((kho) => (
          <div key={kho.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{kho.ten_kho}</p>
                <p className="text-xs text-gray-500">{kho.ma_kho}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                kho.loai_kho === "trung_tam" ? "bg-blue-100 text-blue-700" : kho.loai_kho === "cua_hang" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
              }`}>
                {kho.loai_kho === "trung_tam" ? "Trung tâm" : kho.loai_kho === "cua_hang" ? "Cửa hàng" : "Tạm"}
              </span>
            </div>
            {kho.dia_chi && <p className="mt-2 text-xs text-gray-500">{kho.dia_chi}</p>}
            {kho.dien_thoai && <p className="text-xs text-gray-500">SĐT: {kho.dien_thoai}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== ĐƠN VỊ TÍNH ====================
function DonViTinhSubTab() {
  const [list, setList] = useState<DonViTinh[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wms/don-vi-tinh")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setList(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Mã</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">ĐV mua</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">ĐV sử dụng</th>
            <th className="px-4 py-2 text-right font-medium text-gray-500">Hệ số quy đổi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
          ) : list.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có đơn vị tính</td></tr>
          ) : list.map((dvt) => (
            <tr key={dvt.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
              <td className="px-4 py-2 font-mono text-xs">{dvt.ma_dvt}</td>
              <td className="px-4 py-2">{dvt.ten_dvt}</td>
              <td className="px-4 py-2 text-gray-500">{dvt.dv_mua || "—"}</td>
              <td className="px-4 py-2 text-gray-500">{dvt.dv_su_dung || "—"}</td>
              <td className="px-4 py-2 text-right">{dvt.he_so_quy_doi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==================== PHÂN LOẠI ====================
function PhanLoaiSubTab() {
  const [list, setList] = useState<PhanLoaiHH[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wms/phan-loai")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setList(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Mã</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Tên</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Thuộc tính</th>
            <th className="px-4 py-2 text-left font-medium text-gray-500">Nhiệt độ</th>
            <th className="px-4 py-2 text-center font-medium text-gray-500">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Đang tải...</td></tr>
          ) : list.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Chưa có phân loại</td></tr>
          ) : list.map((pl) => (
            <tr key={pl.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
              <td className="px-4 py-2 font-mono text-xs">{pl.ma_phan_loai}</td>
              <td className="px-4 py-2">{pl.ten_phan_loai}</td>
              <td className="px-4 py-2 text-gray-500">{pl.thuoc_tinh}</td>
              <td className="px-4 py-2 text-xs">{NHIET_DO_LABEL[pl.nhiet_do] || pl.nhiet_do}</td>
              <td className="px-4 py-2 text-center">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  pl.trang_thai === "hoat_dong" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>{pl.trang_thai === "hoat_dong" ? "HĐ" : pl.trang_thai}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
