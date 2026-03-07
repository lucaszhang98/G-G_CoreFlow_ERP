/**
 * 拆柜账单导出 Excel（按拆柜人员分组）
 */

import ExcelJS from 'exceljs';

export interface UnloadBillExportRow {
  container_number: string;
  total_box_count: number;
  planned_unload_at: string | null;
  amount: number;
  unloaded_by_name: string;
}

/**
 * 按拆柜人员分组生成 Excel
 * @param grouped  key = 拆柜人员名称, value = 该人员下的行
 * @param filename 文件名（不含扩展名）
 */
export async function generateUnloadBillExportExcel(
  grouped: Map<string, UnloadBillExportRow[]>,
  filename: string = '拆柜账单'
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('拆柜账单（按拆柜人员）', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 0 }],
  });

  const headerStyle = {
    font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2563EB' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
  };
  const titleStyle = {
    font: { bold: true, size: 12 },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0E7FF' } },
  };

  let currentRow = 1;
  const colW = { A: 18, B: 12, C: 14, D: 12, E: 14 };

  for (const [personName, rows] of grouped.entries()) {
    sheet.getCell(currentRow, 1).value = `拆柜人员：${personName}`;
    sheet.getCell(currentRow, 1).style = titleStyle;
    sheet.mergeCells(currentRow, 1, currentRow, 5);
    currentRow += 1;

    sheet.getCell(currentRow, 1).value = '柜号';
    sheet.getCell(currentRow, 2).value = '总箱数';
    sheet.getCell(currentRow, 3).value = '拆柜日期';
    sheet.getCell(currentRow, 4).value = '价格';
    sheet.getCell(currentRow, 5).value = '拆柜人员';
    [1, 2, 3, 4, 5].forEach((c) => {
      sheet.getCell(currentRow, c).style = headerStyle;
    });
    currentRow += 1;

    for (const r of rows) {
      sheet.getCell(currentRow, 1).value = r.container_number || '';
      sheet.getCell(currentRow, 2).value = r.total_box_count;
      sheet.getCell(currentRow, 3).value = r.planned_unload_at ?? '';
      sheet.getCell(currentRow, 4).value = r.amount;
      sheet.getCell(currentRow, 5).value = r.unloaded_by_name || '';
      currentRow += 1;
    }

    currentRow += 1;
  }

  sheet.getColumn(1).width = colW.A;
  sheet.getColumn(2).width = colW.B;
  sheet.getColumn(3).width = colW.C;
  sheet.getColumn(4).width = colW.D;
  sheet.getColumn(5).width = colW.E;

  return workbook;
}
