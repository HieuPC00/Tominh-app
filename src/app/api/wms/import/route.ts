import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // "nha_cung_cap" | "hang_hoa"
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

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row && row.some((cell) => String(cell || "").includes("Mã nhà cung cấp") || String(cell || "").includes("Tên nhà cung cấp"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header trong file. Cần có cột: STT, Mã nhà cung cấp, Tên nhà cung cấp, Địa chỉ, MST/CCCD, SĐT" }, { status: 400 });
  }

  // Cols: 0=STT, 1=Mã nhà cung cấp, 2=Tên nhà cung cấp, 3=Địa chỉ, 4=MST/CCCD, 5=SĐT
  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r[1]);
  const records = dataRows.map((r) => ({
    ma_ncc: String(r[1] || "").trim(),
    ten_ncc: String(r[2] || "").trim(),
    dia_chi: r[3] ? String(r[3]).trim() : null,
    ma_so_thue: r[4] ? String(r[4]).trim() : null,
    dien_thoai: r[5] ? String(r[5]).trim() : null,
  })).filter((r) => r.ma_ncc && r.ten_ncc);

  // Check for duplicates in database
  const maCodes = records.map((r) => r.ma_ncc);
  const { data: existing } = await supabase
    .from("nha_cung_cap")
    .select("ma_ncc, ten_ncc")
    .in("ma_ncc", maCodes);

  const existingSet = new Set((existing || []).map((e: { ma_ncc: string }) => e.ma_ncc));
  const duplicates = (existing || []) as { ma_ncc: string; ten_ncc: string }[];
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
    if (row && row.some((cell) => String(cell || "") === "Mã" || String(cell || "").includes("Tên"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    return NextResponse.json({ error: "Không tìm thấy header trong file" }, { status: 400 });
  }

  const { data: dvtList } = await supabase.from("don_vi_tinh").select("id, ten_dvt, ma_dvt");
  const { data: plList } = await supabase.from("phan_loai_hh").select("id, ten_phan_loai, ma_phan_loai");

  const dvtMap = new Map<string, string>();
  (dvtList || []).forEach((d: { id: string; ten_dvt: string; ma_dvt: string }) => {
    dvtMap.set(d.ten_dvt.toLowerCase(), d.id);
    dvtMap.set(d.ma_dvt.toLowerCase(), d.id);
  });

  const plMap = new Map<string, string>();
  (plList || []).forEach((p: { id: string; ten_phan_loai: string; ma_phan_loai: string }) => {
    plMap.set(p.ten_phan_loai.toLowerCase(), p.id);
    plMap.set(p.ma_phan_loai.toLowerCase(), p.id);
  });

  const dataRows = rows.slice(headerIdx + 1).filter((r) => r && r[1]);
  const records = dataRows.map((r) => {
    const nhomVTHH = String(r[4] || "").trim();
    const dvtText = String(r[5] || "").trim();
    const hsdText = String(r[6] || "").trim();

    let hsdNgay: number | null = null;
    if (hsdText) {
      const numMatch = hsdText.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        if (hsdText.includes("tháng")) hsdNgay = num * 30;
        else if (hsdText.includes("ngày")) hsdNgay = num;
        else if (hsdText.includes("năm")) hsdNgay = num * 365;
      }
    }

    return {
      ma_hang_hoa: String(r[1] || "").trim(),
      ten: String(r[2] || "").trim(),
      phan_loai_id: plMap.get(nhomVTHH.toLowerCase()) || null,
      dvt_id: dvtMap.get(dvtText.toLowerCase()) || null,
      nguon_goc: r[7] ? String(r[7]).trim() : null,
      han_su_dung_ngay: hsdNgay,
      gia_binh_quan: r[8] ? parseFloat(String(r[8])) || 0 : 0,
    };
  }).filter((r) => r.ma_hang_hoa && r.ten);

  // Check for duplicates
  const maCodes = records.map((r) => r.ma_hang_hoa);
  const { data: existing } = await supabase
    .from("hang_hoa")
    .select("ma_hang_hoa, ten")
    .in("ma_hang_hoa", maCodes.slice(0, 1000));

  const existingSet = new Set((existing || []).map((e: { ma_hang_hoa: string }) => e.ma_hang_hoa));
  const duplicates = (existing || []) as { ma_hang_hoa: string; ten: string }[];
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
