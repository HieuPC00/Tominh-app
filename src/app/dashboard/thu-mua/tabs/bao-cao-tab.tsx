"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PhieuDatHang, PhieuDatHangItem, ThanhToanNCC } from "@/types/wms";

function formatMoney(n: number): string {
  return n.toLocaleString("vi-VN");
}

interface MonthlyStats {
  soDon: number;
  tongGiaTri: number;
  daTT: number;
  conNo: number;
  soNCC: number;
  soMatHang: number;
}

interface TopNCC {
  ncc_id: string;
  ma_ncc: string;
  ten_ncc: string;
  so_don: number;
  gia_tri: number;
  ty_trong: number;
}

interface ItemSummary {
  ten_hang_hoa: string;
  don_vi_tinh: string;
  tong_sl: number;
  gia_min: number;
  gia_max: number;
  chenh_lech: number;
  tong_tien: number;
}

interface PriceDetail {
  ma_phieu: string;
  ngay_dat: string;
  ma_ncc: string;
  ten_ncc: string;
  so_luong: number;
  don_vi_tinh: string;
  don_gia: number;
  vat_pct: number;
  so_voi_tb: number;
}

interface PriceStats {
  giaMin: number;
  giaMax: number;
  giaTB: number;
  chenhLech: number;
  pctChenhLech: number;
  soLanMua: number;
}

export default function BaoCaoTab() {
  return (
    <div className="space-y-8">
      <MonthlyReportSection />
      <PriceComparisonSection />
    </div>
  );
}

// ==================== MONTHLY REPORT ====================
function MonthlyReportSection() {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [topNCCs, setTopNCCs] = useState<TopNCC[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);

  const fetchReport = useCallback(async () => {
    if (!month) return;
    setLoading(true);

    try {
      const [year, m] = month.split("-").map(Number);
      const fromDate = `${year}-${String(m).padStart(2, "0")}-01`;
      // Last day of month
      const lastDay = new Date(year, m, 0).getDate();
      const toDate = `${year}-${String(m).padStart(2, "0")}-${lastDay}`;

      // Fetch POs for month
      const poRes = await fetch(
        `/api/wms/phieu-dat-hang?from_date=${fromDate}&to_date=${toDate}&limit=1000`
      );
      const poData = await poRes.json();
      const poList: PhieuDatHang[] = (poData?.data || []).filter(
        (po: PhieuDatHang) => po.trang_thai !== "huy"
      );

      // Fetch payments for month
      const payRes = await fetch(
        `/api/wms/thanh-toan-ncc?from_date=${fromDate}&to_date=${toDate}&limit=5000`
      );
      const payData = await payRes.json();
      const payList: ThanhToanNCC[] = payData?.data || [];

      // Fetch PO items for detail
      let allItems: (PhieuDatHangItem & { po: PhieuDatHang })[] = [];

      // Fetch items for each PO
      for (const po of poList) {
        try {
          const itemRes = await fetch(`/api/wms/phieu-dat-hang/${po.id}`);
          if (itemRes.ok) {
            const poDetail = await itemRes.json();
            const poItems: PhieuDatHangItem[] = poDetail?.items || poDetail?.phieu_dat_hang_items || [];
            for (const item of poItems) {
              allItems.push({ ...item, po });
            }
          }
        } catch {
          // skip
        }
      }

      // Calculate stats
      const tongGiaTri = poList.reduce((s, po) => s + (po.tong_tien || 0), 0);
      const daTT = payList.reduce((s, p) => s + (p.so_tien || 0), 0);
      const nccSet = new Set(poList.map((po) => po.ncc_id));
      const itemNameSet = new Set(allItems.map((it) => it.ten_hang_hoa));

      setStats({
        soDon: poList.length,
        tongGiaTri,
        daTT,
        conNo: tongGiaTri - daTT,
        soNCC: nccSet.size,
        soMatHang: itemNameSet.size,
      });

      // Top NCC
      const nccMap = new Map<
        string,
        { ncc_id: string; ma_ncc: string; ten_ncc: string; so_don: number; gia_tri: number }
      >();
      for (const po of poList) {
        const nccId = po.ncc_id;
        const ncc = po.nha_cung_cap;
        if (!nccMap.has(nccId)) {
          nccMap.set(nccId, {
            ncc_id: nccId,
            ma_ncc: ncc?.ma_ncc || "—",
            ten_ncc: ncc?.ten_ncc || "—",
            so_don: 0,
            gia_tri: 0,
          });
        }
        const entry = nccMap.get(nccId)!;
        entry.so_don += 1;
        entry.gia_tri += po.tong_tien || 0;
      }

      const topNCCList: TopNCC[] = Array.from(nccMap.values())
        .map((entry) => ({
          ...entry,
          ty_trong: tongGiaTri > 0 ? (entry.gia_tri / tongGiaTri) * 100 : 0,
        }))
        .sort((a, b) => b.gia_tri - a.gia_tri);

      setTopNCCs(topNCCList);

      // Item summary
      const itemMap = new Map<
        string,
        {
          ten_hang_hoa: string;
          don_vi_tinh: string;
          tong_sl: number;
          prices: number[];
          tong_tien: number;
        }
      >();
      for (const item of allItems) {
        const key = item.ten_hang_hoa;
        if (!itemMap.has(key)) {
          itemMap.set(key, {
            ten_hang_hoa: item.ten_hang_hoa,
            don_vi_tinh: item.don_vi_tinh || "—",
            tong_sl: 0,
            prices: [],
            tong_tien: 0,
          });
        }
        const entry = itemMap.get(key)!;
        entry.tong_sl += item.so_luong || 0;
        if (item.don_gia > 0) entry.prices.push(item.don_gia);
        entry.tong_tien +=
          (item.so_luong || 0) *
          (item.don_gia || 0) *
          (1 + (item.vat_pct || 0) / 100);
      }

      const itemSummaries: ItemSummary[] = Array.from(itemMap.values())
        .map((entry) => {
          const giaMin = entry.prices.length > 0 ? Math.min(...entry.prices) : 0;
          const giaMax = entry.prices.length > 0 ? Math.max(...entry.prices) : 0;
          return {
            ...entry,
            gia_min: giaMin,
            gia_max: giaMax,
            chenh_lech: giaMax - giaMin,
          };
        })
        .sort((a, b) => b.tong_tien - a.tong_tien);

      setItems(itemSummaries);
    } catch {
      setStats(null);
      setTopNCCs([]);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Bao cao thang
        </h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        {loading && (
          <span className="text-xs text-gray-400">Dang tai...</span>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">So don</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.soDon}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">Tong gia tri</p>
            <p className="text-xl font-bold text-blue-600">
              {formatMoney(stats.tongGiaTri)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">Da TT</p>
            <p className="text-xl font-bold text-green-600">
              {formatMoney(stats.daTT)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">Con no</p>
            <p className="text-xl font-bold text-red-600">
              {formatMoney(stats.conNo)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">So NCC</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.soNCC}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
            <p className="text-xs text-gray-500">So mat hang</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {stats.soMatHang}
            </p>
          </div>
        </div>
      )}

      {/* Top NCC table */}
      {topNCCs.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Top NCC theo gia tri mua hang
            </h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Ma NCC
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Ten
                  </th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">
                    So don
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Gia tri
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Ty trong
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {topNCCs.map((ncc, idx) => (
                  <tr
                    key={ncc.ncc_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td className="px-3 py-2 text-center text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                      {ncc.ma_ncc}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                      {ncc.ten_ncc}
                    </td>
                    <td className="px-3 py-2 text-center">{ncc.so_don}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(ncc.gia_tri)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{
                              width: `${Math.min(100, ncc.ty_trong)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {ncc.ty_trong.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item summary table */}
      {items.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Tong hop mat hang
            </h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <tr>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    Ten hang
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">
                    DVT
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Tong SL
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Gia min
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Gia max
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Chenh lech
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">
                    Tong tien
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    <td className="px-3 py-2 text-center text-gray-400">
                      {idx + 1}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                      {item.ten_hang_hoa}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {item.don_vi_tinh}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.tong_sl)}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      {item.gia_min > 0 ? formatMoney(item.gia_min) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {item.gia_max > 0 ? formatMoney(item.gia_max) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.chenh_lech > 0 ? (
                        <span className="text-orange-600">
                          {formatMoney(item.chenh_lech)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(Math.round(item.tong_tien))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && stats && stats.soDon === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 dark:border-gray-800 dark:bg-gray-950">
          Khong co don dat hang trong thang nay
        </div>
      )}
    </div>
  );
}

// ==================== PRICE COMPARISON ====================
function PriceComparisonSection() {
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [loading, setLoading] = useState(false);
  const [priceStats, setPriceStats] = useState<PriceStats | null>(null);
  const [priceDetails, setPriceDetails] = useState<PriceDetail[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search items from POs
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchText.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        // Fetch all POs to get item names
        const res = await fetch(
          `/api/wms/phieu-dat-hang?limit=500`
        );
        const data = await res.json();
        const poList: PhieuDatHang[] = data?.data || [];

        // Get item names from each PO
        const nameSet = new Set<string>();
        for (const po of poList) {
          try {
            const itemRes = await fetch(`/api/wms/phieu-dat-hang/${po.id}`);
            if (itemRes.ok) {
              const poDetail = await itemRes.json();
              const poItems: PhieuDatHangItem[] =
                poDetail?.items || poDetail?.phieu_dat_hang_items || [];
              for (const item of poItems) {
                if (
                  item.ten_hang_hoa &&
                  item.ten_hang_hoa
                    .toLowerCase()
                    .includes(searchText.toLowerCase())
                ) {
                  nameSet.add(item.ten_hang_hoa);
                }
              }
            }
          } catch {
            // skip
          }
        }

        setSuggestions(Array.from(nameSet).slice(0, 20));
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText]);

  // Fetch price details when item selected
  const fetchPriceData = useCallback(async (itemName: string) => {
    if (!itemName) return;
    setLoading(true);

    try {
      // Fetch all POs
      const res = await fetch(`/api/wms/phieu-dat-hang?limit=1000`);
      const data = await res.json();
      const poList: PhieuDatHang[] = (data?.data || []).filter(
        (po: PhieuDatHang) => po.trang_thai !== "huy"
      );

      // Find items matching name across all POs
      const details: PriceDetail[] = [];

      for (const po of poList) {
        try {
          const itemRes = await fetch(`/api/wms/phieu-dat-hang/${po.id}`);
          if (itemRes.ok) {
            const poDetail = await itemRes.json();
            const poItems: PhieuDatHangItem[] =
              poDetail?.items || poDetail?.phieu_dat_hang_items || [];
            for (const item of poItems) {
              if (item.ten_hang_hoa === itemName) {
                details.push({
                  ma_phieu: po.ma_phieu,
                  ngay_dat: po.ngay_dat,
                  ma_ncc: po.nha_cung_cap?.ma_ncc || "—",
                  ten_ncc: po.nha_cung_cap?.ten_ncc || "—",
                  so_luong: item.so_luong,
                  don_vi_tinh: item.don_vi_tinh || "—",
                  don_gia: item.don_gia,
                  vat_pct: item.vat_pct || 0,
                  so_voi_tb: 0,
                });
              }
            }
          }
        } catch {
          // skip
        }
      }

      // Calculate stats
      if (details.length > 0) {
        const prices = details.map((d) => d.don_gia).filter((p) => p > 0);
        const giaMin = prices.length > 0 ? Math.min(...prices) : 0;
        const giaMax = prices.length > 0 ? Math.max(...prices) : 0;
        const giaTB =
          prices.length > 0
            ? prices.reduce((s, p) => s + p, 0) / prices.length
            : 0;
        const chenhLech = giaMax - giaMin;
        const pctChenhLech = giaTB > 0 ? (chenhLech / giaTB) * 100 : 0;

        setPriceStats({
          giaMin,
          giaMax,
          giaTB,
          chenhLech,
          pctChenhLech,
          soLanMua: details.length,
        });

        // Compute so_voi_tb for each
        for (const d of details) {
          d.so_voi_tb = giaTB > 0 ? ((d.don_gia - giaTB) / giaTB) * 100 : 0;
        }
      } else {
        setPriceStats(null);
      }

      // Sort by date desc
      details.sort(
        (a, b) =>
          new Date(b.ngay_dat).getTime() - new Date(a.ngay_dat).getTime()
      );

      setPriceDetails(details);
    } catch {
      setPriceStats(null);
      setPriceDetails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSelectItem(name: string) {
    setSelectedItem(name);
    setSearchText(name);
    setShowSuggestions(false);
    fetchPriceData(name);
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        So sanh gia
      </h2>

      {/* Search input */}
      <div ref={wrapperRef} className="relative max-w-md">
        <input
          type="text"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setSelectedItem("");
          }}
          placeholder="Tim ten hang hoa de so sanh gia..."
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
            {suggestions.map((name, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectItem(name)}
                className="flex w-full px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-800"
              >
                <span className="truncate text-gray-900 dark:text-gray-100">
                  {name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="py-4 text-center text-sm text-gray-400">
          Dang phan tich gia...
        </div>
      )}

      {/* Price stats */}
      {selectedItem && priceStats && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
              Thong ke gia: {selectedItem}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-gray-500">Gia thap nhat</p>
                <p className="text-lg font-bold text-green-600">
                  {formatMoney(priceStats.giaMin)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gia cao nhat</p>
                <p className="text-lg font-bold text-red-600">
                  {formatMoney(priceStats.giaMax)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gia TB</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatMoney(Math.round(priceStats.giaTB))}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Chenh lech</p>
                <p className="text-lg font-bold text-orange-600">
                  {formatMoney(priceStats.chenhLech)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">% Chenh lech</p>
                <p className="text-lg font-bold text-orange-600">
                  {priceStats.pctChenhLech.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">So lan mua</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {priceStats.soLanMua}
                </p>
              </div>
            </div>
          </div>

          {/* Price detail table */}
          {priceDetails.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Chi tiet mua hang
                </h3>
              </div>
              <div className="overflow-auto">
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
                        NCC
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        SL
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">
                        DVT
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        Don gia
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        VAT%
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">
                        So voi TB
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {priceDetails.map((d, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                          {d.ma_phieu}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">
                          {new Date(d.ngay_dat).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 text-gray-900 dark:text-gray-100">
                          <span className="mr-1 font-mono text-xs text-gray-400">
                            {d.ma_ncc}
                          </span>
                          {d.ten_ncc}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatMoney(d.so_luong)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {d.don_vi_tinh}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(d.don_gia)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {d.vat_pct}%
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`text-xs font-medium ${
                              d.so_voi_tb > 0
                                ? "text-red-600"
                                : d.so_voi_tb < 0
                                  ? "text-green-600"
                                  : "text-gray-400"
                            }`}
                          >
                            {d.so_voi_tb > 0 ? "+" : ""}
                            {d.so_voi_tb.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedItem && !loading && priceDetails.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-400 dark:border-gray-800 dark:bg-gray-950">
          Khong tim thay du lieu gia cho mat hang nay
        </div>
      )}
    </div>
  );
}
