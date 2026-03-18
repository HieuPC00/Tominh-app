import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // "nha_cung_cap" | "hang_hoa" | "don_vi_tinh" | "phan_loai_hh"
    const duplicateMode = (formData.get("duplicate_mode") as string) || "check";
    // "check" = first pass, detect duplicates and return list
    // "skip"  = insert only new records, skip duplicates
    // "overwrite" = upsert, overwrite existing records

    if (!file) {
      return NextResponse.json({ error: "Không có file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (type === "nha_cung_cap") {
      return await importNhaCungCap(supabase, workbook, duplicateMode);
    } else if (type === "hang_hoa") {
      return await importHangHoa(supabase, workbook, duplicateMode);
    } else if (type === "don_vi_tinh") {
      return await importDonViTinh(supabase, workbook, duplicateMode);
    } else if (type === "phan_loai_hh") {
      return await importPhanLoaiHH(supabase, workbook, duplicateMode);
    }

    return NextResponse.json({ error: "Loại import không hợp lệ" }, { status: 400 });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json({ error: "Lỗi import file" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importNhaCungCap(supabase: any, workbook: XLSX.WorkBook, duplicateMode: string) {
  const sheetName = workbook.SheetNames.find((s) =>
    s.toLowerCase().includes("nhà cung cấp") || s.toLowerCase().includes("nha cung cap")
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  // Find header row — look for any recognizable NCC column header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowText = row.map((cell) => String(cell || "").toLowerCase());
    if (rowText.some((t) =>
      t.includes("mã nhà cung cấp") || t.includes("tên nhà cung cấp") ||
      t.includes("mã ncc") || t.includes("tên ncc") ||
      (t.includes("mst") && rowText.some((t2) => t2.includes("địa chỉ") || t2.includes("dia chi")))
    )) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header trong file. Cần có cột: Mã nhà cung cấp, Tên nhà cung cấp, Địa chỉ, MST/CCCD, SĐT" }, { status: 400 });
  }

  // Dynamically detect column positions from header row
  const headerRow = rows[headerIdx].map((cell) => String(cell || "").toLowerCase().trim());
  const colMap = { ma: -1, ten: -1, diaChi: -1, mst: -1, sdt: -1 };

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes("mã nhà cung cấp") || h.includes("mã ncc") || h === "mã") {
      colMap.ma = c;
    } else if (h.includes("tên nhà cung cấp") || h.includes("tên ncc") || h === "tên") {
      colMap.ten = c;
    } else if (h.includes("địa chỉ") || h.includes("dia chi") || h === "địa chỉ") {
      colMap.diaChi = c;
    } else if (h.includes("mst") || h.includes("mã số thuế") || h.includes("cccd") || h.includes("ma so thue")) {
      colMap.mst = c;
    } else if (h.includes("sđt") || h.includes("số điện thoại") || h.includes("điện thoại") || h.includes("sdt") || h === "đt") {
      colMap.sdt = c;
    }
  }

  // If no "mã" column found, the file might not have separate code column
  // In that case ten_ncc becomes the key identifier
  const hasMaCol = colMap.ma !== -1;
  const hasTenCol = colMap.ten !== -1;

  if (!hasMaCol && !hasTenCol) {
    return NextResponse.json({ error: "Không tìm thấy cột Mã NCC hoặc Tên NCC trong header" }, { status: 400 });
  }

  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r.length > 1);
  const records = dataRows.map((r) => {
    const ma = hasMaCol ? String(r[colMap.ma] || "").trim().slice(0, 50) : "";
    const ten = hasTenCol ? String(r[colMap.ten] || "").trim().slice(0, 255) : "";
    const diaChi = colMap.diaChi !== -1 && r[colMap.diaChi] ? String(r[colMap.diaChi]).trim() : null;
    const mst = colMap.mst !== -1 && r[colMap.mst] ? String(r[colMap.mst]).trim().slice(0, 50) : null;
    const sdt = colMap.sdt !== -1 && r[colMap.sdt] ? String(r[colMap.sdt]).trim().slice(0, 30) : null;
    return { ma_ncc: ma, ten_ncc: ten, dia_chi: diaChi, ma_so_thue: mst, dien_thoai: sdt };
  }).filter((r) => (r.ma_ncc || r.ten_ncc));

  // If no ma_ncc column, auto-generate codes from ten_ncc
  if (!hasMaCol) {
    let autoIdx = 1;
    for (const rec of records) {
      if (!rec.ma_ncc && rec.ten_ncc) {
        rec.ma_ncc = `NCC${String(autoIdx).padStart(4, "0")}`;
        autoIdx++;
      }
    }
  }

  // Debug info for troubleshooting
  const debugInfo = {
    headerRow: headerRow.map((h, i) => `[${i}]=${h}`),
    colMap,
    hasMaCol,
    hasTenCol,
    sampleRecords: records.slice(0, 3).map((r) => ({
      ma_ncc: r.ma_ncc,
      ten_ncc: r.ten_ncc?.slice(0, 40),
      dia_chi: r.dia_chi?.slice(0, 30),
      mst: r.ma_so_thue,
      sdt: r.dien_thoai,
    })),
  };

  // Check for duplicates: fetch all existing ma_ncc then compare in JS
  const importCodes = new Set(records.map((r) => r.ma_ncc));
  const { data: allNcc, error: queryErr } = await supabase
    .from("nha_cung_cap")
    .select("ma_ncc, ten_ncc")
    .order("ma_ncc")
    .limit(5000);

  if (queryErr) {
    console.error("Duplicate check query error:", queryErr);
  }

  const duplicates = (allNcc || [])
    .filter((row: { ma_ncc: string }) => importCodes.has(row.ma_ncc)) as { ma_ncc: string; ten_ncc: string }[];
  const existingSet = new Set(duplicates.map((e) => e.ma_ncc));
  const duplicateCount = duplicates.length;

  // Mode: check — just return duplicate info, don't insert
  if (duplicateMode === "check" && duplicateCount > 0) {
    return NextResponse.json({
      success: false,
      has_duplicates: true,
      type: "nha_cung_cap",
      total: records.length,
      duplicate_count: duplicateCount,
      duplicates: duplicates.slice(0, 20).map((d) => `${d.ma_ncc} - ${d.ten_ncc}`),
      new_count: records.length - duplicateCount,
      debug: debugInfo,
    });
  }

  // Determine which records to insert
  let toInsert = records;
  if (duplicateMode === "skip") {
    toInsert = records.filter((r) => !existingSet.has(r.ma_ncc));
  }

  let inserted = 0;
  let skipped = duplicateMode === "skip" ? duplicateCount : 0;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      type: "nha_cung_cap",
      total: records.length,
      inserted: 0,
      skipped: records.length,
      errors: [],
      debug: debugInfo,
    });
  }

  // For "skip" mode: plain insert (no duplicates in toInsert)
  // For "overwrite" or "check" with no duplicates: upsert
  if (duplicateMode === "skip") {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase
        .from("nha_cung_cap")
        .insert(batch)
        .select();

      if (error) {
        errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length || batch.length;
      }
    }
  } else {
    // "overwrite" or "check" with no duplicates
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase
        .from("nha_cung_cap")
        .upsert(batch, { onConflict: "ma_ncc", ignoreDuplicates: false })
        .select();

      if (error) {
        errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length || batch.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    type: "nha_cung_cap",
    total: records.length,
    inserted,
    skipped,
    overwritten: duplicateMode === "overwrite" ? duplicateCount : 0,
    errors,
    debug: debugInfo,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importHangHoa(supabase: any, workbook: XLSX.WorkBook, duplicateMode: string) {
  const sheetName = workbook.SheetNames.find((s) =>
    s.toLowerCase().includes("hàng hóa") || s.toLowerCase().includes("hang hoa")
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowText = row.map((cell) => String(cell || "").toLowerCase());
    if (rowText.some((t) =>
      t === "mã" || t.includes("mã hàng") || t.includes("tên hàng") ||
      t.includes("ma hang") || t.includes("ten hang") ||
      t.includes("tính chất") || t.includes("đơn vị tính") ||
      (t.includes("đvt") && rowText.some((t2) => t2.includes("tên")))
    )) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header trong file" }, { status: 400 });
  }

  // Dynamically detect column positions from header row
  const headerRow = rows[headerIdx].map((cell) => String(cell || "").toLowerCase().trim());
  const hhColMap = { ma: -1, ten: -1, tinhChat: -1, nhomVTHH: -1, dvt: -1, hsd: -1, nguonGoc: -1, gia: -1 };

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h === "mã" || h.includes("mã hàng") || h.includes("ma hang") || h === "mã hh") {
      hhColMap.ma = c;
    } else if (h === "tên" || h.includes("tên hàng") || h.includes("ten hang") || h === "tên hàng hóa") {
      if (hhColMap.ten === -1) hhColMap.ten = c;
    } else if (h.includes("tính chất") || h.includes("tinh chat") || h.includes("quy cách") || h.includes("đóng gói")) {
      hhColMap.tinhChat = c;
    } else if (h.includes("nhóm") || h.includes("phân loại") || h.includes("vthh") || h.includes("loại")) {
      hhColMap.nhomVTHH = c;
    } else if (h.includes("đvt") || h.includes("đơn vị tính") || h.includes("don vi")) {
      hhColMap.dvt = c;
    } else if (h.includes("thời hạn") || h.includes("hạn sử dụng") || h.includes("hsd") || h.includes("bảo hành") || h.includes("han su dung")) {
      hhColMap.hsd = c;
    } else if (h.includes("nguồn gốc") || h.includes("xuất xứ") || h.includes("nguon goc")) {
      hhColMap.nguonGoc = c;
    } else if (h.includes("giá") || h.includes("gia") || h.includes("đơn giá")) {
      hhColMap.gia = c;
    }
  }

  // --- Auto-create missing DVT and Phân loại from Excel data ---
  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r.length > 1);

  // Collect unique DVT and Nhóm VTHH values from Excel
  const uniqueDvtNames = new Set<string>();
  const uniquePlNames = new Set<string>();
  for (const r of dataRows) {
    const dvtText = hhColMap.dvt !== -1 ? String(r[hhColMap.dvt] || "").trim() : "";
    const plText = hhColMap.nhomVTHH !== -1 ? String(r[hhColMap.nhomVTHH] || "").trim() : "";
    if (dvtText) uniqueDvtNames.add(dvtText);
    if (plText) uniquePlNames.add(plText);
  }

  // Fetch existing DVT, auto-create missing ones
  const { data: dvtList } = await supabase.from("don_vi_tinh").select("id, ten_dvt, ma_dvt");
  const dvtMap = new Map<string, string>();
  (dvtList || []).forEach((d: { id: string; ten_dvt: string; ma_dvt: string }) => {
    dvtMap.set(d.ten_dvt.toLowerCase(), d.id);
    dvtMap.set(d.ma_dvt.toLowerCase(), d.id);
  });

  // Create missing DVT entries
  const missingDvt = [...uniqueDvtNames].filter((name) => !dvtMap.has(name.toLowerCase()));
  if (missingDvt.length > 0) {
    let dvtIdx = (dvtList || []).length + 1;
    for (let i = 0; i < missingDvt.length; i += 50) {
      const batch = missingDvt.slice(i, i + 50).map((name) => ({
        ma_dvt: `DVT${String(dvtIdx++).padStart(3, "0")}`,
        ten_dvt: name,
        he_so_quy_doi: 1,
      }));
      const { data: created } = await supabase.from("don_vi_tinh").upsert(batch, { onConflict: "ma_dvt", ignoreDuplicates: true }).select("id, ten_dvt, ma_dvt");
      if (created) {
        for (const d of created) {
          dvtMap.set(d.ten_dvt.toLowerCase(), d.id);
          dvtMap.set(d.ma_dvt.toLowerCase(), d.id);
        }
      }
    }
  }

  // Fetch existing Phân loại, auto-create missing ones
  const { data: plList } = await supabase.from("phan_loai_hh").select("id, ten_phan_loai, ma_phan_loai");
  const plMap = new Map<string, string>();
  (plList || []).forEach((p: { id: string; ten_phan_loai: string; ma_phan_loai: string }) => {
    plMap.set(p.ten_phan_loai.toLowerCase(), p.id);
    plMap.set(p.ma_phan_loai.toLowerCase(), p.id);
  });

  // Create missing Phân loại entries
  const missingPl = [...uniquePlNames].filter((name) => !plMap.has(name.toLowerCase()));
  if (missingPl.length > 0) {
    let plIdx = (plList || []).length + 1;
    for (let i = 0; i < missingPl.length; i += 50) {
      const batch = missingPl.slice(i, i + 50).map((name) => ({
        ma_phan_loai: `PL${String(plIdx++).padStart(3, "0")}`,
        ten_phan_loai: name,
        thuoc_tinh: "",
        nhiet_do: "thuong" as const,
      }));
      const { data: created } = await supabase.from("phan_loai_hh").upsert(batch, { onConflict: "ma_phan_loai", ignoreDuplicates: true }).select("id, ten_phan_loai, ma_phan_loai");
      if (created) {
        for (const p of created) {
          plMap.set(p.ten_phan_loai.toLowerCase(), p.id);
          plMap.set(p.ma_phan_loai.toLowerCase(), p.id);
        }
      }
    }
  }

  // --- Build hang_hoa records with resolved DVT & Phân loại IDs ---
  const records = dataRows.map((r) => {
    const nhomVTHH = hhColMap.nhomVTHH !== -1 ? String(r[hhColMap.nhomVTHH] || "").trim() : "";
    const dvtText = hhColMap.dvt !== -1 ? String(r[hhColMap.dvt] || "").trim() : "";
    const hsdText = hhColMap.hsd !== -1 ? String(r[hhColMap.hsd] || "").trim() : "";

    let hsdNgay: number | null = null;
    if (hsdText) {
      if (hsdText.includes("không thời hạn") || hsdText.includes("Không thời hạn")) {
        hsdNgay = null;
      } else {
        const numMatch = hsdText.match(/(\d+)/);
        if (numMatch) {
          const num = parseInt(numMatch[1]);
          if (hsdText.includes("tháng")) hsdNgay = num * 30;
          else if (hsdText.includes("ngày")) hsdNgay = num;
          else if (hsdText.includes("năm")) hsdNgay = num * 365;
          else hsdNgay = num;
        }
      }
    }

    return {
      ma_hang_hoa: hhColMap.ma !== -1 ? String(r[hhColMap.ma] || "").trim() : "",
      ten: hhColMap.ten !== -1 ? String(r[hhColMap.ten] || "").trim() : "",
      quy_cach: hhColMap.tinhChat !== -1 && r[hhColMap.tinhChat] ? String(r[hhColMap.tinhChat]).trim() : null,
      phan_loai_id: plMap.get(nhomVTHH.toLowerCase()) || null,
      dvt_id: dvtMap.get(dvtText.toLowerCase()) || null,
      nguon_goc: hhColMap.nguonGoc !== -1 && r[hhColMap.nguonGoc] ? String(r[hhColMap.nguonGoc]).trim() : null,
      han_su_dung_ngay: hsdNgay,
      gia_binh_quan: hhColMap.gia !== -1 && r[hhColMap.gia] ? parseFloat(String(r[hhColMap.gia])) || 0 : 0,
      is_deleted: false,
    };
  }).filter((r) => r.ma_hang_hoa && r.ten);

  // Check for duplicates: fetch all existing ma_hang_hoa then compare in JS
  const importCodes = new Set(records.map((r) => r.ma_hang_hoa));
  const allHH: { ma_hang_hoa: string; ten: string }[] = [];
  // Fetch in pages of 1000 (hang_hoa can have thousands of records)
  let page = 0;
  while (true) {
    const { data: batch, error: qErr } = await supabase
      .from("hang_hoa")
      .select("ma_hang_hoa, ten")
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (qErr) { console.error("Duplicate check error:", qErr); break; }
    if (!batch || batch.length === 0) break;
    allHH.push(...(batch as { ma_hang_hoa: string; ten: string }[]));
    if (batch.length < 1000) break;
    page++;
  }

  const duplicates = allHH.filter((row) => importCodes.has(row.ma_hang_hoa));
  const existingSet = new Set(duplicates.map((e) => e.ma_hang_hoa));
  const duplicateCount = duplicates.length;

  if (duplicateMode === "check" && duplicateCount > 0) {
    return NextResponse.json({
      success: false,
      has_duplicates: true,
      type: "hang_hoa",
      total: records.length,
      duplicate_count: duplicateCount,
      duplicates: duplicates.slice(0, 20).map((d) => `${d.ma_hang_hoa} - ${d.ten}`),
      new_count: records.length - duplicateCount,
    });
  }

  let toInsert = records;
  if (duplicateMode === "skip") {
    toInsert = records.filter((r) => !existingSet.has(r.ma_hang_hoa));
  }

  let inserted = 0;
  let skipped = duplicateMode === "skip" ? duplicateCount : 0;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({
      success: true,
      type: "hang_hoa",
      total: records.length,
      inserted: 0,
      skipped: records.length,
      errors: [],
    });
  }

  if (duplicateMode === "skip") {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase
        .from("hang_hoa")
        .insert(batch)
        .select();

      if (error) {
        errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length || batch.length;
      }
    }
  } else {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase
        .from("hang_hoa")
        .upsert(batch, { onConflict: "ma_hang_hoa", ignoreDuplicates: false })
        .select();

      if (error) {
        errors.push(`Batch ${i / 50 + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length || batch.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    type: "hang_hoa",
    total: records.length,
    inserted,
    skipped,
    overwritten: duplicateMode === "overwrite" ? duplicateCount : 0,
    errors,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importDonViTinh(supabase: any, workbook: XLSX.WorkBook, duplicateMode: string) {
  const sheetName = workbook.SheetNames.find((s) =>
    s.toLowerCase().includes("đơn vị") || s.toLowerCase().includes("don vi") || s.toLowerCase().includes("dvt")
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowText = row.map((cell) => String(cell || "").toLowerCase());
    if (rowText.some((t) =>
      t.includes("mã đvt") || t.includes("mã dvt") || t.includes("tên đvt") || t.includes("tên dvt") ||
      t.includes("đơn vị tính") || t.includes("don vi tinh") ||
      (t.includes("đvt") && rowText.some((t2) => t2.includes("tên")))
    )) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header. Cần có cột: Mã ĐVT, Tên ĐVT" }, { status: 400 });
  }

  const headerRow = rows[headerIdx].map((cell) => String(cell || "").toLowerCase().trim());
  const colMap = { ma: -1, ten: -1, dvMua: -1, dvSuDung: -1, heSo: -1 };

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes("mã đvt") || h.includes("mã dvt") || h === "mã") {
      colMap.ma = c;
    } else if (h.includes("tên đvt") || h.includes("tên dvt") || h === "tên" || h.includes("đơn vị tính") || h.includes("tên đơn vị")) {
      if (colMap.ten === -1) colMap.ten = c;
    } else if (h.includes("đv mua") || h.includes("dv mua") || h.includes("đơn vị mua")) {
      colMap.dvMua = c;
    } else if (h.includes("đv sử dụng") || h.includes("dv su dung") || h.includes("đơn vị sử dụng")) {
      colMap.dvSuDung = c;
    } else if (h.includes("hệ số") || h.includes("he so") || h.includes("quy đổi") || h.includes("quy doi")) {
      colMap.heSo = c;
    }
  }

  if (colMap.ma === -1 && colMap.ten === -1) {
    return NextResponse.json({ error: "Không tìm thấy cột Mã ĐVT hoặc Tên ĐVT trong header" }, { status: 400 });
  }

  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r.length > 0);
  const records = dataRows.map((r) => ({
    ma_dvt: colMap.ma !== -1 ? String(r[colMap.ma] || "").trim() : "",
    ten_dvt: colMap.ten !== -1 ? String(r[colMap.ten] || "").trim() : "",
    dv_mua: colMap.dvMua !== -1 && r[colMap.dvMua] ? String(r[colMap.dvMua]).trim() : null,
    dv_su_dung: colMap.dvSuDung !== -1 && r[colMap.dvSuDung] ? String(r[colMap.dvSuDung]).trim() : null,
    he_so_quy_doi: colMap.heSo !== -1 && r[colMap.heSo] ? parseFloat(String(r[colMap.heSo])) || 1 : 1,
  })).filter((r) => r.ma_dvt && r.ten_dvt);

  // Auto-gen ma_dvt if column missing
  if (colMap.ma === -1) {
    let autoIdx = 1;
    for (const rec of records) {
      if (!rec.ma_dvt && rec.ten_dvt) {
        rec.ma_dvt = `DVT${String(autoIdx).padStart(3, "0")}`;
        autoIdx++;
      }
    }
  }

  // Duplicate check
  const importCodes = new Set(records.map((r) => r.ma_dvt));
  const { data: allDvt } = await supabase
    .from("don_vi_tinh")
    .select("ma_dvt, ten_dvt")
    .order("ma_dvt")
    .limit(5000);

  const duplicates = (allDvt || [])
    .filter((row: { ma_dvt: string }) => importCodes.has(row.ma_dvt)) as { ma_dvt: string; ten_dvt: string }[];
  const existingSet = new Set(duplicates.map((e) => e.ma_dvt));
  const duplicateCount = duplicates.length;

  if (duplicateMode === "check" && duplicateCount > 0) {
    return NextResponse.json({
      success: false,
      has_duplicates: true,
      type: "don_vi_tinh",
      total: records.length,
      duplicate_count: duplicateCount,
      duplicates: duplicates.slice(0, 20).map((d) => `${d.ma_dvt} - ${d.ten_dvt}`),
      new_count: records.length - duplicateCount,
    });
  }

  let toInsert = records;
  if (duplicateMode === "skip") {
    toInsert = records.filter((r) => !existingSet.has(r.ma_dvt));
  }

  let inserted = 0;
  let skipped = duplicateMode === "skip" ? duplicateCount : 0;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({ success: true, type: "don_vi_tinh", total: records.length, inserted: 0, skipped: records.length, errors: [] });
  }

  if (duplicateMode === "skip") {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase.from("don_vi_tinh").insert(batch).select();
      if (error) { errors.push(`Batch ${i / 50 + 1}: ${error.message}`); skipped += batch.length; }
      else { inserted += data?.length || batch.length; }
    }
  } else {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase.from("don_vi_tinh").upsert(batch, { onConflict: "ma_dvt", ignoreDuplicates: false }).select();
      if (error) { errors.push(`Batch ${i / 50 + 1}: ${error.message}`); skipped += batch.length; }
      else { inserted += data?.length || batch.length; }
    }
  }

  return NextResponse.json({
    success: true,
    type: "don_vi_tinh",
    total: records.length,
    inserted,
    skipped,
    overwritten: duplicateMode === "overwrite" ? duplicateCount : 0,
    errors,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importPhanLoaiHH(supabase: any, workbook: XLSX.WorkBook, duplicateMode: string) {
  const sheetName = workbook.SheetNames.find((s) =>
    s.toLowerCase().includes("phân loại") || s.toLowerCase().includes("phan loai") || s.toLowerCase().includes("nhóm")
  ) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (!row) continue;
    const rowText = row.map((cell) => String(cell || "").toLowerCase());
    if (rowText.some((t) =>
      t.includes("mã phân loại") || t.includes("tên phân loại") ||
      t.includes("ma phan loai") || t.includes("ten phan loai") ||
      t.includes("nhóm hàng") || t.includes("nhóm vthh") ||
      (t.includes("phân loại") && rowText.some((t2) => t2.includes("tên") || t2.includes("mã")))
    )) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header. Cần có cột: Mã phân loại, Tên phân loại" }, { status: 400 });
  }

  const headerRow = rows[headerIdx].map((cell) => String(cell || "").toLowerCase().trim());
  const colMap = { ma: -1, ten: -1, thuocTinh: -1, nhietDo: -1 };

  for (let c = 0; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h.includes("mã phân loại") || h.includes("mã nhóm") || h === "mã") {
      colMap.ma = c;
    } else if (h.includes("tên phân loại") || h.includes("tên nhóm") || h === "tên" || h.includes("nhóm hàng") || h.includes("nhóm vthh")) {
      if (colMap.ten === -1) colMap.ten = c;
    } else if (h.includes("thuộc tính") || h.includes("thuoc tinh") || h.includes("mô tả") || h.includes("ghi chú")) {
      colMap.thuocTinh = c;
    } else if (h.includes("nhiệt độ") || h.includes("nhiet do") || h.includes("bảo quản")) {
      colMap.nhietDo = c;
    }
  }

  if (colMap.ma === -1 && colMap.ten === -1) {
    return NextResponse.json({ error: "Không tìm thấy cột Mã hoặc Tên phân loại trong header" }, { status: 400 });
  }

  const nhietDoMap: Record<string, string> = {
    "thường": "thuong", "thuong": "thuong", "bình thường": "thuong",
    "mát": "mat", "mat": "mat",
    "lạnh": "lanh", "lanh": "lanh",
    "đông": "dong", "dong": "dong",
  };

  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r.length > 0);
  const records = dataRows.map((r) => {
    const nhietDoText = colMap.nhietDo !== -1 && r[colMap.nhietDo] ? String(r[colMap.nhietDo]).trim().toLowerCase() : "";
    return {
      ma_phan_loai: colMap.ma !== -1 ? String(r[colMap.ma] || "").trim() : "",
      ten_phan_loai: colMap.ten !== -1 ? String(r[colMap.ten] || "").trim() : "",
      thuoc_tinh: colMap.thuocTinh !== -1 && r[colMap.thuocTinh] ? String(r[colMap.thuocTinh]).trim() : "",
      nhiet_do: nhietDoMap[nhietDoText] || "thuong",
    };
  }).filter((r) => r.ma_phan_loai || r.ten_phan_loai);

  // Auto-gen ma_phan_loai if column missing
  if (colMap.ma === -1) {
    let autoIdx = 1;
    for (const rec of records) {
      if (!rec.ma_phan_loai && rec.ten_phan_loai) {
        rec.ma_phan_loai = `PL${String(autoIdx).padStart(3, "0")}`;
        autoIdx++;
      }
    }
  }

  // Duplicate check
  const importCodes = new Set(records.map((r) => r.ma_phan_loai));
  const { data: allPl } = await supabase
    .from("phan_loai_hh")
    .select("ma_phan_loai, ten_phan_loai")
    .order("ma_phan_loai")
    .limit(5000);

  const duplicates = (allPl || [])
    .filter((row: { ma_phan_loai: string }) => importCodes.has(row.ma_phan_loai)) as { ma_phan_loai: string; ten_phan_loai: string }[];
  const existingSet = new Set(duplicates.map((e) => e.ma_phan_loai));
  const duplicateCount = duplicates.length;

  if (duplicateMode === "check" && duplicateCount > 0) {
    return NextResponse.json({
      success: false,
      has_duplicates: true,
      type: "phan_loai_hh",
      total: records.length,
      duplicate_count: duplicateCount,
      duplicates: duplicates.slice(0, 20).map((d) => `${d.ma_phan_loai} - ${d.ten_phan_loai}`),
      new_count: records.length - duplicateCount,
    });
  }

  let toInsert = records;
  if (duplicateMode === "skip") {
    toInsert = records.filter((r) => !existingSet.has(r.ma_phan_loai));
  }

  let inserted = 0;
  let skipped = duplicateMode === "skip" ? duplicateCount : 0;
  const errors: string[] = [];

  if (toInsert.length === 0) {
    return NextResponse.json({ success: true, type: "phan_loai_hh", total: records.length, inserted: 0, skipped: records.length, errors: [] });
  }

  if (duplicateMode === "skip") {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase.from("phan_loai_hh").insert(batch).select();
      if (error) { errors.push(`Batch ${i / 50 + 1}: ${error.message}`); skipped += batch.length; }
      else { inserted += data?.length || batch.length; }
    }
  } else {
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      const { error, data } = await supabase.from("phan_loai_hh").upsert(batch, { onConflict: "ma_phan_loai", ignoreDuplicates: false }).select();
      if (error) { errors.push(`Batch ${i / 50 + 1}: ${error.message}`); skipped += batch.length; }
      else { inserted += data?.length || batch.length; }
    }
  }

  return NextResponse.json({
    success: true,
    type: "phan_loai_hh",
    total: records.length,
    inserted,
    skipped,
    overwritten: duplicateMode === "overwrite" ? duplicateCount : 0,
    errors,
  });
}
