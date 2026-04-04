"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { NhaCungCap, HangHoa, NccZaloGroup } from "@/types/wms";

const subTabs = [
  { id: "nha-cung-cap", label: "Nha cung cap" },
  { id: "hang-hoa", label: "Hang hoa" },
  { id: "zalo-group", label: "Zalo Group" },
];

const NHIET_DO_LABEL: Record<string, string> = {
  thuong: "Thuong",
  mat: "Mat (2-8C)",
  lanh: "Lanh (0-2C)",
  dong: "Dong (<-18C)",
};

const TRANG_THAI_LABEL: Record<string, string> = {
  hoat_dong: "Hoat dong",
  tam_khoa: "Tam khoa",
  ngung: "Ngung",
};

export default function DanhMucTab() {
  const [activeSubTab, setActiveSubTab] = useState("nha-cung-cap");

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

      {activeSubTab === "nha-cung-cap" && <NhaCungCapSubTab />}
      {activeSubTab === "hang-hoa" && <HangHoaSubTab />}
      {activeSubTab === "zalo-group" && <ZaloGroupSubTab />}
    </div>
  );
}

// ==================== IMPORT EXCEL BUTTON ====================
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

function ImportExcelButton({
  type,
  onDone,
}: {
  type: "nha_cung_cap" | "hang_hoa";
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(
    null
  );

  async function doImport(file: File, duplicateMode: string) {
    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("duplicate_mode", duplicateMode);

    try {
      const res = await fetch("/api/wms/import", {
        method: "POST",
        body: formData,
      });
      const data: ImportResult = await res.json();

      if (data.has_duplicates && duplicateMode === "check") {
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
      setResult({ success: false, errors: ["Loi ket noi server"] });
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

  const labelMap: Record<string, string> = {
    nha_cung_cap: "NCC",
    hang_hoa: "hang hoa",
  };
  const label = labelMap[type] || type;

  return (
    <div className="inline-flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={importing}
        className="rounded border border-green-600 px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50 disabled:opacity-50 dark:hover:bg-green-950"
      >
        {importing ? "Dang import..." : "Import Excel"}
      </button>
      {result && (
        <span
          className={`text-xs ${result.success ? "text-green-600" : "text-red-600"}`}
        >
          {result.success
            ? `Thanh cong: ${result.inserted} moi${result.overwritten ? `, ${result.overwritten} cap nhat` : ""}${result.skipped ? `, ${result.skipped} bo qua` : ""} / ${result.total} dong`
            : result.errors?.[0] || "Loi"}
          {result.errors && result.errors.length > 0 && (
            <span className="ml-1 text-red-500">
              ({result.errors.join("; ")})
            </span>
          )}
        </span>
      )}

      {/* Duplicate confirmation popup */}
      {duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-lg font-semibold text-orange-600">
              Phat hien {duplicateInfo.duplicate_count} {label} trung ma
            </h3>
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              File co{" "}
              <strong>{duplicateInfo.total}</strong> dong, trong do{" "}
              <strong className="text-orange-600">
                {duplicateInfo.duplicate_count}
              </strong>{" "}
              ma da ton tai va{" "}
              <strong className="text-green-600">
                {duplicateInfo.new_count}
              </strong>{" "}
              ma moi.
            </p>

            {duplicateInfo.duplicates.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-1 text-xs font-medium text-gray-500">
                  Danh sach trung (toi da 20):
                </p>
                {duplicateInfo.duplicates.map((d, i) => (
                  <p
                    key={i}
                    className="truncate text-xs text-gray-600 dark:text-gray-400"
                  >
                    {d}
                  </p>
                ))}
              </div>
            )}

            <p className="mb-4 text-sm font-medium">
              Ban muon xu ly nhu the nao?
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => handleDuplicateChoice("skip")}
                disabled={importing}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {importing
                  ? "Dang xu ly..."
                  : `Bo qua trung (chi them ${duplicateInfo.new_count} moi)`}
              </button>
              <button
                onClick={() => handleDuplicateChoice("overwrite")}
                disabled={importing}
                className="flex-1 rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {importing
                  ? "Dang xu ly..."
                  : `Ghi de tat ca (${duplicateInfo.total} dong)`}
              </button>
              <button
                onClick={handleCancel}
                disabled={importing}
                className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
              >
                Huy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== NHA CUNG CAP ====================
const PAGE_SIZE = 50;

function NhaCungCapSubTab() {
  const [list, setList] = useState<NhaCungCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [fMa, setFMa] = useState("");
  const [fTen, setFTen] = useState("");
  const [fDiaChi, setFDiaChi] = useState("");
  const [fMST, setFMST] = useState("");
  const [fSDT, setFSDT] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fNguoiLH, setFNguoiLH] = useState("");
  const [fGhiChu, setFGhiChu] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/wms/nha-cung-cap?${params}`);
      const data = await res.json();
      setList(data?.data || (Array.isArray(data) ? data : []));
      setTotal(data?.total ?? 0);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  function resetForm() {
    setFMa("");
    setFTen("");
    setFDiaChi("");
    setFMST("");
    setFSDT("");
    setFEmail("");
    setFNguoiLH("");
    setFGhiChu("");
    setEditingId(null);
  }

  function handleEdit(ncc: NhaCungCap) {
    setEditingId(ncc.id);
    setFMa(ncc.ma_ncc);
    setFTen(ncc.ten_ncc);
    setFDiaChi(ncc.dia_chi || "");
    setFMST(ncc.ma_so_thue || "");
    setFSDT(ncc.dien_thoai || "");
    setFEmail(ncc.email || "");
    setFNguoiLH(ncc.nguoi_lien_he || "");
    setFGhiChu(ncc.ghi_chu || "");
    setShowForm(true);
    setError("");
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoa NCC nay?")) return;
    try {
      await fetch(`/api/wms/nha-cung-cap?id=${id}`, { method: "DELETE" });
      fetchList();
    } catch {
      /* ignore */
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const body = {
      ma_ncc: fMa,
      ten_ncc: fTen,
      dia_chi: fDiaChi || null,
      ma_so_thue: fMST || null,
      dien_thoai: fSDT || null,
      email: fEmail || null,
      nguoi_lien_he: fNguoiLH || null,
      ghi_chu: fGhiChu || null,
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/wms/nha-cung-cap?id=${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/wms/nha-cung-cap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Loi tao nha cung cap");
        setSubmitting(false);
        return;
      }

      setShowForm(false);
      resetForm();
      setSubmitting(false);
      fetchList();
    } catch {
      setError("Loi ket noi server");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Tim ma, ten NCC, MST..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-60 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <div className="flex gap-2">
          {total > 0 && (
            <button
              onClick={async () => {
                if (
                  !confirm(
                    `Xoa tat ca ${total} NCC? Hanh dong nay khong the hoan tac!`
                  )
                )
                  return;
                setDeleting(true);
                await fetch("/api/wms/nha-cung-cap?action=delete_all", {
                  method: "DELETE",
                });
                setDeleting(false);
                fetchList();
              }}
              disabled={deleting}
              className="rounded border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
            >
              {deleting ? "Dang xoa..." : `Xoa tat ca (${total})`}
            </button>
          )}
          <ImportExcelButton type="nha_cung_cap" onDone={fetchList} />
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Them NCC
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30"
        >
          {error && (
            <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30">
              {error}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Ma NCC *
              </label>
              <input
                required
                value={fMa}
                onChange={(e) => setFMa(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="NC00128"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">
                Ten nha cung cap *
              </label>
              <input
                required
                value={fTen}
                onChange={(e) => setFTen(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="CONG TY TNHH..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">
                Dia chi
              </label>
              <input
                value={fDiaChi}
                onChange={(e) => setFDiaChi(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Ma so thue / CCCD
              </label>
              <input
                value={fMST}
                onChange={(e) => setFMST(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="0315138097"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Dien thoai
              </label>
              <input
                value={fSDT}
                onChange={(e) => setFSDT(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Email
              </label>
              <input
                type="email"
                value={fEmail}
                onChange={(e) => setFEmail(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                Nguoi lien he
              </label>
              <input
                value={fNguoiLH}
                onChange={(e) => setFNguoiLH(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium">
                Ghi chu
              </label>
              <input
                value={fGhiChu}
                onChange={(e) => setFGhiChu(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Dang luu..."
                : editingId
                  ? "Cap nhat NCC"
                  : "Tao NCC"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm dark:border-gray-700"
            >
              Huy
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ma NCC
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ten
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                SDT
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Email
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                MST
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
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Dang tai...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Chua co nha cung cap
                </td>
              </tr>
            ) : (
              list.map((ncc) => (
                <tr
                  key={ncc.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    {ncc.ma_ncc}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                    {ncc.ten_ncc}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {ncc.dien_thoai || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {ncc.email || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {ncc.ma_so_thue || "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        ncc.trang_thai === "hoat_dong"
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : ncc.trang_thai === "tam_khoa"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {TRANG_THAI_LABEL[ncc.trang_thai] || ncc.trang_thai}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => handleEdit(ncc)}
                        className="rounded p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
                        title="Sua"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(ncc.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Xoa"
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
                    </div>
                  </td>
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
            Hien thi {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} /{" "}
            {total.toLocaleString("vi-VN")} nha cung cap
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &laquo;&laquo;
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &laquo;
            </button>
            <span className="px-3 py-1 text-xs font-medium">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &raquo;
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &raquo;&raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== HANG HOA ====================
function HangHoaSubTab() {
  const [list, setList] = useState<HangHoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fetchList = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    try {
      const res = await fetch(`/api/wms/hang-hoa?${params}`);
      const data = await res.json();
      setList(data?.data || (Array.isArray(data) ? data : []));
      setTotal(data?.total ?? 0);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Tim ma, ten hang hoa..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-60 rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <div className="flex gap-2">
          {total > 0 && (
            <button
              onClick={async () => {
                if (
                  !confirm(
                    `Xoa tat ca ${total} hang hoa? Hanh dong nay khong the hoan tac!`
                  )
                )
                  return;
                setDeleting(true);
                await fetch("/api/wms/hang-hoa?action=delete_all", {
                  method: "DELETE",
                });
                setDeleting(false);
                fetchList();
              }}
              disabled={deleting}
              className="rounded border border-red-600 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
            >
              {deleting ? "Dang xoa..." : `Xoa tat ca (${total})`}
            </button>
          )}
          <ImportExcelButton type="hang_hoa" onDone={fetchList} />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                STT
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ma
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Ten
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                DVT
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Nhom VTHH
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                Nhiet do
              </th>
              <th className="px-3 py-2 text-left font-medium text-gray-500">
                HSD
              </th>
              <th className="px-3 py-2 text-right font-medium text-gray-500">
                Gia
              </th>
              <th className="px-3 py-2 text-center font-medium text-gray-500">
                Trang thai
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Dang tai...
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-gray-400"
                >
                  Chua co hang hoa
                </td>
              </tr>
            ) : (
              list.map((hh, idx) => (
                <tr
                  key={hh.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <td className="px-3 py-2 text-center text-xs text-gray-400">
                    {(page - 1) * PAGE_SIZE + idx + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                    {hh.ma_hang_hoa}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                    {hh.ten}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {hh.don_vi_tinh?.ten_dvt || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {hh.phan_loai?.ten_phan_loai || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {NHIET_DO_LABEL[hh.nhiet_do_bao_quan] ||
                      hh.nhiet_do_bao_quan}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {hh.han_su_dung_ngay
                      ? `${hh.han_su_dung_ngay} ngay`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {Number(hh.gia_binh_quan) > 0
                      ? Number(hh.gia_binh_quan).toLocaleString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        hh.trang_thai === "hoat_dong"
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : hh.trang_thai === "tam_khoa"
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {TRANG_THAI_LABEL[hh.trang_thai] || hh.trang_thai}
                    </span>
                  </td>
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
            Hien thi {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} /{" "}
            {total.toLocaleString("vi-VN")} hang hoa
          </span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &laquo;&laquo;
            </button>
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &laquo;
            </button>
            <span className="px-3 py-1 text-xs font-medium">
              Trang {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &raquo;
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"
            >
              &raquo;&raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== ZALO GROUP SUB-TAB =====================

function ZaloGroupSubTab() {
  const [mappings, setMappings] = useState<NccZaloGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [nccList, setNccList] = useState<{ id: string; ma_ncc: string; ten_ncc: string }[]>([]);
  const [formNccId, setFormNccId] = useState("");
  const [formGroupId, setFormGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wms/ncc-zalo-group?limit=200");
      if (res.ok) { const data = await res.json(); setMappings(data?.data || []); }
    } catch { setMappings([]); }
    finally { setLoading(false); }
  }, []);

  const fetchNcc = useCallback(async () => {
    try {
      const res = await fetch("/api/wms/nha-cung-cap?limit=500&trang_thai=hoat_dong");
      if (res.ok) { const data = await res.json(); setNccList(data?.data || []); }
    } catch { setNccList([]); }
  }, []);

  useEffect(() => { fetchMappings(); fetchNcc(); }, [fetchMappings, fetchNcc]);

  async function handleAdd() {
    if (!formNccId || !formGroupId.trim()) { setFormError("Chon NCC va nhap Zalo Group ID"); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch("/api/wms/ncc-zalo-group", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ncc_id: formNccId, zalo_group_id: formGroupId.trim() }),
      });
      if (!res.ok) { const err = await res.json(); setFormError(err.error || "Loi"); return; }
      setFormNccId(""); setFormGroupId(""); fetchMappings();
    } catch { setFormError("Loi ket noi"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xoa mapping nay?")) return;
    try { await fetch(`/api/wms/ncc-zalo-group?id=${id}`, { method: "DELETE" }); fetchMappings(); }
    catch { alert("Loi xoa"); }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mapping NCC ↔ Zalo Group</h3>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">NCC</label>
            <select value={formNccId} onChange={(e) => setFormNccId(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
              <option value="">-- Chon NCC --</option>
              {nccList.map((n) => <option key={n.id} value={n.id}>{n.ma_ncc} - {n.ten_ncc}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Zalo Group ID</label>
            <input type="text" value={formGroupId} onChange={(e) => setFormGroupId(e.target.value)}
              placeholder="VD: 2225045345975894137"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
          </div>
          <div className="flex items-end">
            <button onClick={handleAdd} disabled={submitting}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? "Dang luu..." : "Them"}
            </button>
          </div>
        </div>
        {formError && <p className="mt-2 text-sm text-red-500">{formError}</p>}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Dang tai...</p>
      ) : mappings.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">Chua co mapping nao</p>
      ) : (
        <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">STT</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Ma NCC</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Ten NCC</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Zalo Group ID</th>
                <th className="px-4 py-2 text-center font-medium text-gray-500">Xoa</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m, i) => (
                <tr key={m.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs text-blue-600">{m.nha_cung_cap?.ma_ncc || "—"}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{m.nha_cung_cap?.ten_ncc || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{m.zalo_group_id}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:text-red-700">Xoa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
