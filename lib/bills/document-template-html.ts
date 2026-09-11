// Auto-generated 100% exact Pixel-Perfect 3-Page Document System with Left-Aligned 2-Row Checkboxes
import { thaiBahtText, type BillDocumentModel } from "@/lib/bills/bill-document";
import { toNumber } from "@/lib/utils/numbers";

export const DOCUMENT_PAGE_STYLES = "\n<style>\n@import url('https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');\n\n*, *::before, *::after {\n  box-sizing: border-box;\n}\n\nhtml, body {\n  margin: 0;\n  padding: 0;\n  width: 100%;\n  background-color: #525659;\n  font-family: 'Sarabun', system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans Thai\", \"Thonburi\", sans-serif;\n  -webkit-font-smoothing: antialiased;\n  color: #000000;\n}\n\nbody {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: flex-start;\n  padding: 24px 0;\n  min-height: 100vh;\n}\n\n.a4-document-container {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 28px;\n  width: 100%;\n}\n\n.a4-page {\n  background: #ffffff;\n  width: 210mm;\n  min-height: 297mm;\n  max-width: 210mm;\n  padding: 16mm 18mm 16mm 18mm;\n  margin: 0 auto;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);\n  position: relative;\n  page-break-after: always;\n  break-after: page;\n  box-sizing: border-box;\n  overflow: hidden;\n  font-size: 13.5px;\n  line-height: 1.4;\n  color: #000000;\n}\n\n.a4-page-3 {\n  padding: 10mm 12mm 10mm 12mm;\n  font-size: 11px;\n  line-height: 1.35;\n}\n\n.a4-page:last-child {\n  page-break-after: auto;\n  break-after: auto;\n}\n\n/* Form underline elements */\n.u-line {\n  border-bottom: 1px solid #000000;\n  display: inline-block;\n  text-align: center;\n  padding-bottom: 1px;\n}\n\n/* Checkbox boxes */\n.check-box {\n  width: 13px;\n  height: 13px;\n  border: 1.2px solid #000000;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  font-size: 10px;\n  font-weight: bold;\n  vertical-align: middle;\n  margin-right: 3px;\n  background: #ffffff;\n  flex-shrink: 0;\n}\n.check-box.checked::after {\n  content: '✓';\n  font-size: 12px;\n  line-height: 1;\n}\n\n/* Page 3 Unified Outer Frame */\n.p3-outer-frame {\n  width: 100%;\n  border: 1.5px solid #000000;\n  display: flex;\n  flex-direction: column;\n  background: #ffffff;\n}\n\n.p3-row-border {\n  border-bottom: 1.2px solid #000000;\n}\n\n/* Page 3 Tax Table styles */\n.tax-table {\n  width: 100%;\n  border-collapse: collapse;\n  border: none;\n  font-size: 10.5px;\n}\n.tax-table th, .tax-table td {\n  border-right: 1.2px solid #000000;\n  padding: 3.5px 6px;\n  vertical-align: top;\n}\n.tax-table th:last-child, .tax-table td:last-child {\n  border-right: none;\n}\n.tax-table th {\n  border-bottom: 1.2px solid #000000;\n  text-align: center;\n  font-weight: bold;\n  padding: 5px 2px;\n  font-size: 11px;\n}\n.tax-table tr.dashed-row td {\n  border-bottom: 1px dashed #000000;\n}\n.tax-table tr.solid-row td {\n  border-bottom: 1.2px solid #000000;\n}\n\n.digit-box {\n  display: inline-flex;\n  border: 1px solid #000000;\n  height: 22px;\n  align-items: center;\n  justify-content: center;\n  font-family: 'Sarabun', monospace, sans-serif;\n  font-weight: bold;\n  font-size: 11px;\n  padding: 0 6px;\n  letter-spacing: 0.5px;\n  width: 180px;\n  min-width: 180px;\n  background: #fff;\n  white-space: nowrap;\n  overflow: hidden;\n}\n\n@media print {\n  html, body {\n    background: transparent !important;\n    background-color: transparent !important;\n    padding: 0 !important;\n    margin: 0 !important;\n    display: block !important;\n    width: 100% !important;\n  }\n  @page {\n    size: A4 portrait;\n    margin: 6mm 8mm 6mm 8mm;\n  }\n  .a4-document-container {\n    gap: 0 !important;\n    width: 100% !important;\n    display: block !important;\n  }\n  .a4-page {\n    box-shadow: none !important;\n    margin: 0 !important;\n    padding: 10mm 12mm 10mm 12mm !important;\n    width: 100% !important;\n    max-width: 100% !important;\n    min-height: 280mm !important;\n    page-break-after: always !important;\n    break-after: page !important;\n    display: block !important;\n  }\n  .a4-page-3 {\n    padding: 6mm 8mm 6mm 8mm !important;\n  }\n  @page page-landscape {\n    size: A4 landscape;\n    margin: 6mm 8mm 6mm 8mm;\n  }\n  .a4-page-index {\n    page: page-landscape !important;\n    width: 297mm !important;\n    max-width: 297mm !important;\n    min-height: 198mm !important;\n    padding: 6mm 8mm 6mm 8mm !important;\n    page-break-after: always !important;\n    break-after: page !important;\n  }\n  .a4-page:last-child {\n    page-break-after: auto !important;\n    break-after: auto !important;\n  }\n}\n\n.a4-page-index {\n  page: page-landscape;\n  background: #ffffff;\n  width: 297mm;\n  min-height: 210mm;\n  max-width: 297mm;\n  padding: 8mm 12mm 8mm 12mm;\n  margin: 0 auto;\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);\n  position: relative;\n  page-break-after: always;\n  break-after: page;\n  box-sizing: border-box;\n  overflow: hidden;\n  font-size: 11px;\n  line-height: 1.35;\n  color: #000000;\n}\n</style>\n";
export const PAGE_1_HTML_TEMPLATE = "\n<div style=\"text-align: center; margin-bottom: 22px; line-height: 1.35;\">\n  <div style=\"font-size: 16px; font-weight: bold;\"><<[ชื่อบริษัท]>></div>\n  <div style=\"font-size: 13px; font-weight: normal;\"><<[ชื่ออังกฤษ]>></div>\n  <div style=\"font-size: 13px;\"><<[สำนักงาน]>></div>\n  <div style=\"font-size: 13px;\"><<[ที่อยู่]>></div>\n  <div style=\"font-size: 13px;\">โทร  <<[เบอร์โทร]>> แฟกซ์ 02-2773023</div>\n  <div style=\"font-size: 13px;\">เลขที่ประจำตัวผู้เสียภาษี / TAX PAYERS IDENTIFY CARD NO. <<[เลขที่สียภาษี]>></div>\n</div>\n\n<div style=\"position: relative; text-align: center; margin: 18px 0 24px 0;\">\n  <span style=\"font-size: 19px; font-weight: bold; letter-spacing: 0.5px;\">สัญญาจ้างเหมา</span>\n  <span style=\"position: absolute; right: 0; bottom: 0; font-size: 13.5px;\">วันที่ <b><<[ว/ด/ป]>></b></span>\n</div>\n\n<div style=\"margin-top: 15px; font-size: 13.5px; line-height: 2.1;\">\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 75px; text-align: right; margin-right: 12px; font-weight: 500;\">ข้าพเจ้า</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold;\"><<[ผู้รับเหมา].[ชื่อ-นามสกุล]>></span>\n  </div>\n\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 75px; text-align: right; margin-right: 12px; font-weight: 500;\">อยู่บ้านเลขที่</span>\n    <span class=\"u-line\" style=\"flex: 1;\"><<[ผู้รับเหมา].[ที่อยู่]>></span>\n  </div>\n\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"margin-left: 20px; margin-right: 12px; font-weight: 500;\">บัตรประจำตัวประชาชนเลขที่</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold; letter-spacing: 0.5px;\"><<[ผู้รับเหมา].[บัตรประจำตัวประชาชน]>></span>\n  </div>\n\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 75px; text-align: right; margin-right: 12px; font-weight: 500;\">เบอร์โทรศัพท์</span>\n    <span class=\"u-line\" style=\"width: 250px;\"><<[ผู้รับเหมา].[เบอร์โทรศัพท์]>></span>\n  </div>\n\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 75px; text-align: right; margin-right: 12px; font-weight: 500;\">ได้รับจ้างงาน</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold;\"><<[รายละเอียดงาน]>></span>\n  </div>\n\n  <div style=\"display: flex; align-items: flex-end; flex-wrap: wrap;\">\n    <span style=\"margin-right: 8px; font-weight: 500;\">สถานที่</span>\n    <span class=\"u-line\" style=\"flex: 1; min-width: 200px; font-weight: bold;\"><<[ผู้รับเหมา].[สถานที่]>></span>\n    <span style=\"margin: 0 10px; font-weight: 500;\">จาก</span>\n    <span style=\"font-weight: bold;\"><<[ชื่อบริษัท]>></span>\n  </div>\n\n  <div style=\"margin-top: 15px; margin-left: 110px; line-height: 1.9;\">\n    <div style=\"display: flex; align-items: center;\">\n      <span style=\"width: 170px;\">จำนวนเงินรวมทั้งสิ้น</span>\n      <span style=\"width: 110px; text-align: right; font-weight: bold; font-family: monospace; font-size: 15px;\"><<[ค่าแรง+พนักงาน+อื่น]>></span>\n      <span style=\"margin-left: 20px;\">บาท</span>\n    </div>\n    <div style=\"display: flex; align-items: center;\">\n      <span style=\"width: 170px;\">หัก ภาษีหัก ณ ที่จ่าย <<[หัก]>></span>\n      <span style=\"width: 110px; text-align: right; font-weight: bold; font-family: monospace; font-size: 15px;\"><<[3เปอร์]>></span>\n      <span style=\"margin-left: 20px;\">บาท</span>\n    </div>\n    <div style=\"display: flex; align-items: center; font-weight: bold;\">\n      <span style=\"width: 170px;\">คงเหลือรับสุทธิ</span>\n      <span style=\"width: 110px; text-align: right; font-family: monospace; font-size: 15px;\"><<[รวม]>></span>\n      <span style=\"margin-left: 20px;\">บาท</span>\n    </div>\n  </div>\n\n  <div style=\"margin-top: 20px; line-height: 1.8;\">\n    <div style=\"display: flex; align-items: flex-start;\">\n      <span style=\"width: 110px;\">สิ่งที่แนบมาด้วย :</span>\n      <div style=\"margin-left: 10px;\">\n        <div><span class=\"check-box checked\"></span> สำเนาบัตรประชาชน</div>\n        <div style=\"margin-top: 6px;\"><span class=\"check-box\"></span> สำเนาสมุดบัญชีธนาคาร</div>\n      </div>\n    </div>\n    <div style=\"margin-top: 10px;\">\n      <span>หมายเหตุ :</span>\n    </div>\n  </div>\n</div>\n\n<div style=\"margin-top: 40px; display: flex; justify-content: flex-end;\">\n  <div style=\"width: 290px; text-align: center; line-height: 1.7;\">\n    <div>\n      <span>ลงชื่อ</span>\n      <span class=\"u-line\" style=\"width: 170px; margin: 0 4px;\"></span>\n      <span>ผู้รับเหมา</span>\n    </div>\n    <div style=\"margin-top: 2px; font-weight: 500;\">\n      ( <<[ผู้รับเหมา].[ชื่อ-นามสกุล]>> )\n    </div>\n\n    <div style=\"margin-top: 20px;\">\n      <span>ลงชื่อ</span>\n      <span class=\"u-line\" style=\"width: 170px; margin: 0 4px;\"></span>\n      <span>ผู้คุมงาน</span>\n    </div>\n    <div style=\"margin-top: 2px;\">\n      ( ........................................................... )\n    </div>\n  </div>\n</div>\n";
export const PAGE_2_HTML_TEMPLATE = "\n<div style=\"text-align: center; margin-bottom: 12px; line-height: 1.35;\">\n  <div style=\"font-size: 16px; font-weight: bold;\"><<[ชื่อบริษัท]>></div>\n  <div style=\"font-size: 13px; font-weight: normal;\"><<[ชื่ออังกฤษ]>></div>\n  <div style=\"font-size: 13px;\"><<[สำนักงาน]>></div>\n  <div style=\"font-size: 13px;\"><<[ที่อยู่]>></div>\n  <div style=\"font-size: 13px;\">โทร  <<[เบอร์โทร]>> แฟกซ์ 02-2773023</div>\n  <div style=\"font-size: 13px;\">เลขที่ประจำตัวผู้เสียภาษี / TAX PAYERS IDENTIFY CARD NO. <<[เลขที่สียภาษี]>></div>\n</div>\n\n<div style=\"border-bottom: 1.5px solid #000000; margin: 12px 0 16px 0;\"></div>\n\n<div style=\"text-align: center; margin-bottom: 18px;\">\n  <span style=\"font-size: 18px; font-weight: bold;\">ใบสำคัญจ่าย  (Pretty Cash Voucher)</span>\n</div>\n\n<div style=\"font-size: 13.5px; line-height: 2.1; margin-bottom: 16px;\">\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 80px; text-align: right; margin-right: 12px; font-weight: 500;\">ชื่องาน</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold;\"><<[ID Project].[ชื่อ Project]>></span>\n  </div>\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 80px; text-align: right; margin-right: 12px; font-weight: 500;\">ผู้รับเหมา</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold;\"><<[ผู้รับเหมา].[ชื่อ-นามสกุล]>></span>\n  </div>\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 80px; text-align: right; margin-right: 12px; font-weight: 500;\">สถานที่</span>\n    <span class=\"u-line\" style=\"flex: 1;\"><<[ผู้รับเหมา].[สถานที่]>></span>\n  </div>\n  <div style=\"display: flex; align-items: flex-end;\">\n    <span style=\"width: 80px; text-align: right; margin-right: 12px; font-weight: 500;\">ค่าจ้างเหมา</span>\n    <span class=\"u-line\" style=\"flex: 1; font-weight: bold;\"><<[รายละเอียดงาน]>></span>\n  </div>\n</div>\n\n<table style=\"width: 100%; border-collapse: collapse; border: 1.5px solid #000000; font-size: 13px; text-align: center;\">\n  <thead>\n    <tr style=\"border-bottom: 1.5px solid #000000; font-weight: bold;\">\n      <th style=\"border-right: 1px solid #000000; padding: 6px 4px; width: 14%;\">วันที่</th>\n      <th style=\"border-right: 1px solid #000000; padding: 6px 6px; width: 34%;\">รายละเอียดการปฏิบัติงาน</th>\n      <th style=\"border-right: 1px solid #000000; padding: 4px 4px; width: 22%;\">\n        <div>ยอดเบิก</div>\n        <div style=\"font-size: 11px; font-weight: normal;\">(ก่อนหัก ณ ที่จ่าย)</div>\n      </th>\n      <th style=\"border-right: 1px solid #000000; padding: 6px 4px; width: 20%;\">ผู้รับเงิน</th>\n      <th style=\"padding: 6px 4px; width: 10%;\">หมายเหตุ</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style=\"border-bottom: 1px solid #000000; height: 32px;\">\n      <td style=\"border-right: 1px solid #000000; padding: 4px;\"><<[ว/ด/ป]>></td>\n      <td style=\"border-right: 1px solid #000000; padding: 4px; font-weight: 500;\"><<[รายละเอียดงาน]>></td>\n      <td style=\"border-right: 1px solid #000000; padding: 4px; font-weight: bold; font-family: monospace; font-size: 14px;\"><<[ค่าแรง+พนักงาน+อื่น]>></td>\n      <td style=\"border-right: 1px solid #000000; padding: 4px; font-size: 12px;\"><<[ผู้รับเหมา].[ชื่อ-นามสกุล]>></td>\n      <td style=\"padding: 4px;\"></td>\n    </tr>\n    <!-- 8 Empty Filler Rows matching the original accounting form -->\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n    <tr style=\"border-bottom: 1px solid #000000; height: 26px;\"><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td style=\"border-right: 1px solid #000000;\"></td><td></td></tr>\n  </tbody>\n  <tfoot>\n    <tr style=\"font-weight: bold; height: 32px;\">\n      <td colspan=\"2\" style=\"border-right: 1px solid #000000; text-align: center;\">รวมเบิกเงิน</td>\n      <td style=\"border-right: 1px solid #000000; text-align: center; font-family: monospace; font-size: 14px;\"><<[ค่าแรง+พนักงาน+อื่น]>></td>\n      <td colspan=\"2\" style=\"text-align: center;\">บาท</td>\n    </tr>\n  </tfoot>\n</table>\n\n<div style=\"margin-top: 40px; display: flex; justify-content: flex-end;\">\n  <div style=\"width: 290px; text-align: center; line-height: 1.7;\">\n    <div>\n      <span>ลงชื่อ</span>\n      <span class=\"u-line\" style=\"width: 170px; margin: 0 4px;\"></span>\n      <span>ผู้รับเหมา</span>\n    </div>\n    <div style=\"margin-top: 2px; font-weight: 500;\">\n      ( <<[ผู้รับเหมา].[ชื่อ-นามสกุล]>> )\n    </div>\n\n    <div style=\"margin-top: 20px;\">\n      <span>ลงชื่อ</span>\n      <span class=\"u-line\" style=\"width: 170px; margin: 0 4px;\"></span>\n      <span>ผู้คุมงาน</span>\n    </div>\n    <div style=\"margin-top: 2px;\">\n      ( ........................................................... )\n    </div>\n  </div>\n</div>\n";
export const PAGE_3_HTML_TEMPLATE = `
<div class="p3-outer-frame">
  <!-- Top Row 1: Copy type (ฉบับที่ 1, ฉบับที่ 2) -->
  <div class="p3-row-border" style="padding: 6px 10px; font-size: 10px; line-height: 1.35;">
    <div>ฉบับที่ 1  (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย ใช้แนบพร้อมกับแสดงรายการภาษี)</div>
    <div>ฉบับที่ 2  (สำหรับผู้ถูกหักภาษี ณ ที่จ่าย เก็บไว้เป็นหลักฐาน)</div>
  </div>

  <!-- Top Row 2: Document Title & Book/No. (100% Perfectly Centered Title) -->
  <div class="p3-row-border" style="padding: 8px 10px; position: relative; width: 100%; display: flex; align-items: center; justify-content: center; min-height: 48px;">
    <div style="text-align: center; line-height: 1.25; width: 100%;">
      <div style="font-size: 16px; font-weight: bold; letter-spacing: 0.5px;">หนังสือรับรองการหักภาษี ณ ที่จ่าย</div>
      <div style="font-size: 12px; font-weight: 500;">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</div>
    </div>
    <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 10px; text-align: right; line-height: 1.35; white-space: nowrap;">
      <div>เล่มที่ ....................</div>
      <div>เลขที่ ....................</div>
    </div>
  </div>

  <!-- Box 1: ผู้มีหน้าที่หักภาษี ณ ที่จ่าย -->
  <div class="p3-row-border" style="display: flex;">
    <div style="flex: 1; padding: 6px 10px; border-right: 1.2px solid #000000; line-height: 1.35;">
      <div style="font-weight: bold; font-size: 11px;">ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :</div>
      <div style="margin-top: 2px;">
        <span style="font-weight: bold; margin-right: 6px;">ชื่อ</span>
        <span style="font-weight: bold; font-size: 12px;"><<[ชื่อบริษัท]>></span>
      </div>
      <div style="font-size: 8.5px; color: #333; margin-left: 24px;">(ให้ระบุว่าเป็นบุคคล นิติบุคคล บริษัท สมาคม หรือคณะนิติบุคคล)</div>
      <div style="margin-top: 2px;">
        <span style="font-weight: bold; margin-right: 6px;">ที่อยู่</span>
        <span style="font-size: 11px;"><<[ที่อยู่]>></span>
      </div>
      <div style="font-size: 8.5px; color: #333; margin-left: 24px;">(ให้ระบุชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
    </div>
    <div style="width: 320px; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; gap: 5px; flex-shrink: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
        <span style="white-space: nowrap;">เลขประจำตัวประชาชน</span>
        <span class="digit-box"></span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
        <span style="white-space: nowrap;">เลขประจำตัวผู้เสียภาษีอากร</span>
        <span class="digit-box"><<[เลขที่สียภาษี]>></span>
      </div>
      <div style="font-size: 8.5px; color: #444; text-align: right;">(กรอกเฉพาะกรณีเป็นผู้ไม่มีเลขประจำตัวประชาชน)</div>
    </div>
  </div>

  <!-- Box 2: ผู้ถูกหักภาษี ณ ที่จ่าย -->
  <div class="p3-row-border" style="display: flex;">
    <div style="flex: 1; padding: 6px 10px; border-right: 1.2px solid #000000; line-height: 1.35;">
      <div style="font-weight: bold; font-size: 11px;">ผู้ถูกหักภาษี ณ ที่จ่าย :</div>
      <div style="margin-top: 2px;">
        <span style="font-weight: bold; margin-right: 6px;">ชื่อ</span>
        <span style="font-weight: bold; font-size: 12px;"><<[ผู้รับเหมา].[ชื่อ-นามสกุล]>></span>
      </div>
      <div style="font-size: 8.5px; color: #333; margin-left: 24px;">(ให้ระบุว่าเป็นบุคคล นิติบุคคล บริษัท สมาคม หรือคณะนิติบุคคล)</div>
      <div style="margin-top: 2px;">
        <span style="font-weight: bold; margin-right: 6px;">ที่อยู่</span>
        <span style="font-size: 11px;"><<[ผู้รับเหมา].[ที่อยู่]>></span>
      </div>
      <div style="font-size: 8.5px; color: #333; margin-left: 24px;">(ให้ระบุชื่ออาคาร/หมู่บ้าน ห้องเลขที่ ชั้นที่ เลขที่ ตรอก/ซอย หมู่ที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด)</div>
    </div>
    <div style="width: 320px; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; gap: 5px; flex-shrink: 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
        <span style="white-space: nowrap;">เลขประจำตัวประชาชน</span>
        <span class="digit-box"><<[บัตรประจำตัวประชาชน(per]>></span>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10.5px;">
        <span style="white-space: nowrap;">เลขประจำตัวผู้เสียภาษีอากร</span>
        <span class="digit-box"><<[บัตรประจำตัวประชาชน(บริษัท]>></span>
      </div>
      <div style="font-size: 8.5px; color: #444; text-align: right;">(กรอกเฉพาะกรณีเป็นผู้ไม่มีเลขประจำตัวประชาชน)</div>
    </div>
  </div>

  <!-- Box 3: แบบยื่นภาษี (2 แถว ชิดซ้ายเชื่อมต่อกับ "ในแบบ" ตรงตามต้นฉบับเป๊ะ) -->
  <div class="p3-row-border" style="padding: 6px 10px; font-size: 10.5px; display: flex; align-items: flex-start;">
    <div style="display: flex; align-items: center; white-space: nowrap; margin-top: 1px;">
      <span style="font-weight: bold;">ลำดับที่ *</span>
      <span class="u-line" style="width: 45px; margin: 0 4px;"></span>
      <span style="font-weight: bold; margin-right: 14px;">ในแบบ</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 5px;">
      <!-- แถวที่ 1 -->
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: nowrap;">
        <span style="display: inline-flex; align-items: center;"><span class="check-box"></span> (1) ภ.ง.ด.1ก</span>
        <span style="display: inline-flex; align-items: center;"><span class="check-box"></span> (2) ภ.ง.ด.1กพิเศษ</span>
        <span style="display: inline-flex; align-items: center;"><span class="check-box"></span> (3) ภ.ง.ด.2</span>
        <span style="display: inline-flex; align-items: center;"><span class="check-box <<[CHECK_PND3]>>"></span> (4) ภ.ง.ด.3</span>
      </div>
      <!-- แถวที่ 2 -->
      <div style="display: flex; align-items: center; gap: 14px; flex-wrap: nowrap;">
        <span style="display: inline-flex; align-items: center;"><span class="check-box"></span> (5) ภ.ง.ด.2ก</span>
        <span style="display: inline-flex; align-items: center;"><span class="check-box"></span> (6) ภ.ง.ด.3ก</span>
        <span style="display: inline-flex; align-items: center;"><span class="check-box <<[CHECK_PND53]>>"></span> (7) ภ.ง.ด.53</span>
      </div>
    </div>
  </div>

  <!-- Box 4: Tax Table matching user's image (Equal row height & 100% 1-to-1 alignment) -->
  <div class="p3-row-border">
    <table class="tax-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
      <thead>
        <tr style="height: 30px;">
          <th style="width: 54%; border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; padding: 2px 4px; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle;">ประเภทเงินได้ที่จ่าย</th>
          <th style="width: 15%; border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; padding: 2px 4px; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle;">วัน เดือน ปี<br />ที่จ่ายเงิน</th>
          <th style="width: 16%; border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; padding: 2px 4px; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle;">จำนวนเงิน<br />ที่จ่าย</th>
          <th style="width: 15%; border-bottom: 1.2px solid #000; padding: 2px 4px; font-weight: bold; text-align: center; font-size: 11px; vertical-align: middle;">ภาษี<br />หัก ณ ที่จ่าย</th>
        </tr>
      </thead>
      <tbody>
        <!-- Row 1: Left column has rowspan="20" with 20 items perfectly matched to 20 row heights -->
        <tr style="height: 22.5px;">
          <td rowspan="20" style="vertical-align: top; padding: 0 6px; font-size: 9.8px; border-right: 1.2px solid #000; border-bottom: 1.2px solid #000;">
            <div style="display: flex; flex-direction: column; width: 100%;">
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">1. เงินเดือน ค่าจ้าง เบี้ยเลี้ยง โบนัส ฯลฯ ตามมาตรา 40 (1)</div>
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">2. ค่าธรรมเนียม ค่านายหน้า ฯลฯ ตามมาตรา 40 (2)</div>
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">3. ค่าแห่งลิขสิทธิ์ ฯลฯ ตามมาตรา 40 (3)</div>
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">4. (ก) ค่าดอกเบี้ย ฯลฯ ตามมาตรา 40(4) (ก)</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 12px; white-space: nowrap; overflow: hidden;">(ข) เงินปันผล เงินส่วนแบ่งกำไร ฯลฯ ตามมาตรา 40 (4) (ข)</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 24px; white-space: nowrap; overflow: hidden;">(1) กรณีผู้ได้รับเงินปันผลได้รับเครดิตภาษี โดยจ่ายจากกำไรสุทธิของกิจการฯ</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(1.1) อัตราร้อยละ 30 ของกำไรสุทธิ</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(1.2) อัตราร้อยละ 25 ของกำไรสุทธิ</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(1.3) อัตราร้อยละ 20 ของกำไรสุทธิ</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(1.4) อัตราอื่น ๆ ระบุ...................ของกำไรสุทธิ</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 24px; white-space: nowrap; overflow: hidden;">(2) กรณีผู้ได้รับเงินปันผลไม่ได้รับเครดิตภาษี เนื่องจากจ่ายจาก</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(2.1) กำไรสุทธิของกิจการที่ได้รับยกเว้น</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(2.2) เงินปันผลหรือส่วนแบ่งกำไรที่ได้รับยกเว้นไม่ต้องนำมารวมคำนวณภาษี</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(2.3) กำไรสุทธิส่วนที่ได้หักผลขาดทุนสุทธิยกมาไม่เกิน 5 ปีก่อนรอบระยะบัญชี</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(2.4) กำไรที่รับรู้ทางบัญชีโดยวิธีส่วนได้เสีย (equity method)</div>
              <div style="height: 22.5px; display: flex; align-items: center; padding-left: 36px; white-space: nowrap; overflow: hidden;">(2.5) อื่น ๆ (ระบุ)................................................................</div>
              <div style="height: 22.5px; display: flex; align-items: center; font-weight: 500; font-size: 10px; white-space: nowrap; overflow: hidden;">5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตาม</div>
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">มาตรา 3 เตรส (ระบุ) <b style="text-decoration: underline; text-underline-offset: 2px; margin: 0 4px;"><<[รายละเอียดงาน_หรือ_ค่าจ้าง]>></b>....................................................................</div>
              <div style="height: 22.5px; display: flex; align-items: center; font-size: 8.5px; color: #444; white-space: nowrap; overflow: hidden;">(เช่น รางวัล ส่วนลด ค่าจ้างทำของ ค่าโฆษณา ค่าเช่า ค่าขนส่ง ค่าบริการ ค่าเบี้ยประกันวินาศภัย ฯลฯ)</div>
              <div style="height: 22.5px; display: flex; align-items: center; white-space: nowrap; overflow: hidden;">6. อื่น ๆ ระบุ ..................................................................................................</div>
            </div>
          </td>

          <!-- Col 2, 3, 4 for Row 1 -->
          <td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td>
          <td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td>
          <td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td>
        </tr>

        <!-- Rows 2 to 16 (Empty rows on right with solid line for col 2, dashed for col 3 & 4) -->
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>

        <!-- Row 17: Active Payment Row (matching Item 5) -->
        <tr style="height: 22.5px;">
          <td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; text-align: center; font-family: monospace; font-size: 11.5px; font-weight: bold; vertical-align: middle; padding: 0 4px;"><<[ว/ด/ป]>></td>
          <td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; text-align: right; font-family: monospace; font-size: 11.5px; font-weight: bold; vertical-align: middle; padding: 0 4px;"><<[ค่าแรง+พนักงาน+อื่น]>></td>
          <td style="border-bottom: 1px dashed #444; height: 22.5px; text-align: right; font-family: monospace; font-size: 11.5px; font-weight: bold; vertical-align: middle; padding: 0 4px;"><<[3เปอร์]>></td>
        </tr>

        <!-- Rows 18, 19, 20 -->
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;"><td style="border-right: 1.2px solid #000; border-bottom: 1px solid #000; height: 22.5px; padding: 0;"></td><td style="border-right: 1.2px solid #000; border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td><td style="border-bottom: 1px dashed #444; height: 22.5px; padding: 0;"></td></tr>
        <tr style="height: 22.5px;">
          <td style="border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; height: 22.5px; padding: 0;"></td>
          <td style="border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; height: 22.5px; padding: 0;"></td>
          <td style="border-bottom: 1.2px solid #000; height: 22.5px; padding: 0;"></td>
        </tr>

        <!-- Total Row -->
        <tr style="font-weight: bold; height: 30px;">
          <td colspan="2" style="border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; text-align: center; padding: 4px; vertical-align: middle; font-size: 11.5px;">รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
          <td style="border-right: 1.2px solid #000; border-bottom: 1.2px solid #000; text-align: right; font-family: monospace; font-size: 12px; padding: 4px; vertical-align: middle;"><<[ค่าแรง+พนักงาน+อื่น]>></td>
          <td style="border-bottom: 1.2px solid #000; text-align: right; font-family: monospace; font-size: 12px; padding: 4px; vertical-align: middle;"><<[3เปอร์]>></td>
        </tr>

        <!-- Thai Baht Text Row -->
        <tr style="font-weight: bold; height: 30px;">
          <td colspan="4" style="padding: 4px 10px; vertical-align: middle; font-size: 11.5px;">
            <span>รวมเงินภาษีที่หักนำส่ง (ตัวอักษร)</span>
            <span style="font-weight: bold; margin-left: 16px;"><<[textnumber]>></span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Box 5: ผู้จ่ายเงิน -->
  <div class="p3-row-border" style="padding: 6px 10px; font-size: 10.5px; display: flex; align-items: center; justify-content: space-between;">
    <span style="font-weight: bold;">ผู้จ่ายเงิน</span>
    <div style="display: flex; align-items: center; gap: 16px;">
      <span><span class="check-box"></span> (1) ออกภาษีให้ครั้งเดียว</span>
      <span><span class="check-box"></span> (2) ออกภาษีให้ตลอดไป</span>
      <span><span class="check-box checked"></span> (3) หักภาษี ณ ที่จ่าย</span>
      <span><span class="check-box"></span> (4) อื่น ๆ ....................</span>
    </div>
  </div>

  <!-- Box 6: คำเตือน และหนังสือรับรอง + ตราประทับ -->
  <div style="display: flex; font-size: 9.5px;">
    <div style="width: 38%; padding: 8px 10px; border-right: 1.2px solid #000000; line-height: 1.38;">
      <div style="font-weight: bold; margin-bottom: 3px;">คำเตือน</div>
      <div>ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากรต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร</div>
    </div>
    <div style="flex: 1; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
      <div style="flex: 1; text-align: center; line-height: 1.5; font-size: 10.5px;">
        <div style="font-weight: 500;">ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ</div>
        <div style="margin-top: 10px;">
          <span>ลงชื่อ..................................................................ผู้จ่ายเงิน</span>
        </div>
        <div style="margin-top: 4px;">
          <span>.................../.................../...................</span>
        </div>
        <div style="font-size: 9px; color: #444;">( วัน  เดือน  ปี  ที่ออกหนังสือรับรอง )</div>
      </div>
      <div style="width: 70px; height: 70px; border: 1.2px dashed #444; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 8px; text-align: center; color: #555; margin-left: 10px; flex-shrink: 0;">
        <div>ประทับตรา</div>
        <div>นิติบุคคล</div>
        <div>(ถ้ามี)</div>
      </div>
    </div>
  </div>
</div>
`;

export function buildTemplateReplacements(data: BillDocumentModel): Record<string, string> {
  const laborAndStaff = data.amounts.laborAndStaff.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const withholdingTax = data.amounts.withholdingTax.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const netPayable = data.amounts.netPayable.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  // Format date as dd/mm/yyyy Buddhist year (e.g. 11/2/2569)
  let thaiDate = data.billDate;
  try {
    const parts = data.billDate.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // yyyy-mm-dd
        const y = Number(parts[0]) > 2500 ? Number(parts[0]) : Number(parts[0]) + 543;
        thaiDate = `${Number(parts[2])}/${Number(parts[1])}/${y}`;
      } else {
        // dd-mm-yyyy
        const y = Number(parts[2]) > 2500 ? Number(parts[2]) : Number(parts[2]) + 543;
        thaiDate = `${Number(parts[0])}/${Number(parts[1])}/${y}`;
      }
    }
  } catch {
    thaiDate = data.billDate;
  }

  // Format 13-digit ID nicely
  function format13Digit(id: string): string {
    const clean = (id || "").replace(/\D/g, "");
    if (clean.length === 13) {
      return `${clean[0]} ${clean.slice(1, 5)} ${clean.slice(5, 10)} ${clean.slice(10, 12)} ${clean[12]}`;
    }
    return id || "";
  }

  const jobSpec = data.jobDescription && data.jobDescription !== "-" 
    ? `ค่าจ้างทำของ (${data.jobDescription})` 
    : "ค่าจ้างทำของ";

  return {
    "ชื่อบริษัท": data.company.nameThai || "",
    "ชื่ออังกฤษ": data.company.nameEng || "",
    "สำนักงาน": data.company.branch ? `(${data.company.branch})` : "(สำนักงานใหญ่)",
    "ที่อยู่": data.company.address || "",
    "เบอร์โทร": data.company.phone || "",
    "เลขที่สียภาษี": format13Digit(data.company.taxId || ""),
    "ว/ด/ป": thaiDate,
    "ผู้รับเหมา].[ชื่อ-นามสกุล": data.contractor.fullName || "",
    "ผู้รับเหมา].[ที่อยู่": data.contractor.address || "",
    "ผู้รับเหมา].[บัตรประจำตัวประชาชน": format13Digit(data.contractor.idCard || data.contractor.taxId || ""),
    "ผู้รับเหมา].[เบอร์โทรศัพท์": data.contractor.phone || "",
    "ผู้รับเหมา].[รายละเอียดงาน": data.jobDescription || "",
    "ผู้รับเหมา].[สถานที่": data.project.location || data.project.name || "",
    "ID Project].[ชื่อ Project": data.project.name || "",
    "รายละเอียดงาน": data.jobDescription || "",
    "รายละเอียดงาน_หรือ_ค่าจ้าง": jobSpec,
    "หัก": data.amounts.taxPercent ? `${data.amounts.taxPercent}%` : "3%",
    "ค่าแรง+พนักงาน+อื่น": laborAndStaff,
    "3เปอร์": withholdingTax,
    "รวม": netPayable,
    "textnumber": data.amounts.thaiBahtTextTax || data.amounts.thaiBahtTextTotal || "",
    "บัตรประจำตัวประชาชน(per": !data.contractor.isCorporate ? format13Digit(data.contractor.idCard || "") : "",
    "บัตรประจำตัวประชาชน(บริษัท": data.contractor.isCorporate ? format13Digit(data.contractor.taxId || data.contractor.idCard || "") : format13Digit(data.contractor.taxId || ""),
    "ลำดับ": data.billSequence || "",
    "ลำดับบิล": data.billSequence || "",
    "CHECK_PND3": !data.contractor.isCorporate ? "checked" : "",
    "CHECK_PND53": data.contractor.isCorporate ? "checked" : ""
  };
}

export type BillDocumentPageMode =
  | "all"
  | "contract"
  | "voucher"
  | "tax50twi"
  | "index"
  | "all_with_index";

export function renderDocumentIndexHtml(
  dataList: BillDocumentModel[],
  options?: {
    monthLabel?: string;
    title?: string;
  }
): string {
  if (!dataList || dataList.length === 0) {
    return `<div class="a4-page a4-page-index" style="display:flex;align-items:center;justify-content:center;color:#666;">ไม่มีรายการเอกสารที่เลือก</div>`;
  }

  const company = dataList[0]?.company || {
    nameThai: "บริษัทผู้ว่าจ้าง",
    taxId: "",
    address: "",
    phone: "",
  };

  const totalLabor = dataList.reduce((acc, d) => acc + (d.amounts.laborAndStaff || 0), 0);
  const totalWht = dataList.reduce((acc, d) => acc + (d.amounts.withholdingTax || 0), 0);
  const totalNet = dataList.reduce((acc, d) => acc + (d.amounts.netPayable || 0), 0);
  const totalBase003 = dataList.reduce((acc, d) => {
    const rawVal = toNumber(d.rawBill?.["0.03"]);
    return acc + (rawVal > 0 ? rawVal : (d.amounts.laborAndStaff || 0));
  }, 0);
  const countIndividual = dataList.filter((d) => !d.contractor.isCorporate).length;
  const countCorporate = dataList.filter((d) => d.contractor.isCorporate).length;

  const fmt = (n: number) =>
    (n || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const monthText =
    options?.monthLabel ||
    (dataList[0]?.billDate ? `งวดเอกสาร ${dataList[0].billDate}` : "สรุปรายการเอกสาร");

  // Chunking for A4 Landscape (297mm x 210mm)
  const pagesData: BillDocumentModel[][] = [];
  if (dataList.length <= 12) {
    // Fits on 1 single landscape page with header, KPIs, rows, total, and signatures
    pagesData.push(dataList);
  } else {
    // Multi-page landscape distribution:
    // Page 1: Header + KPI + up to 14 rows
    pagesData.push(dataList.slice(0, 14));
    let start = 14;
    while (start < dataList.length) {
      const remaining = dataList.length - start;
      // If remaining rows + signatures fit on final page (<= 14 rows)
      if (remaining <= 14) {
        pagesData.push(dataList.slice(start));
        break;
      }
      // Intermediate page without top header/KPI and without signatures can fit up to 20 rows
      const chunkSize = remaining <= 26 ? Math.ceil(remaining / 2) : 20;
      pagesData.push(dataList.slice(start, start + chunkSize));
      start += chunkSize;
    }
  }

  const totalPages = pagesData.length;
  let htmlPages = "";

  pagesData.forEach((chunk, pageIndex) => {
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === totalPages - 1;
    const pageNum = pageIndex + 1;

    let pageContent = "";

    if (isFirstPage) {
      pageContent += `
        <!-- Landscape Executive Header: Side-by-side Company & Document Title -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px;">
          <div style="flex: 1; line-height: 1.35;">
            <div style="font-size: 16px; font-weight: bold; color: #000;">${company.nameThai || "บริษัท"}</div>
            <div style="font-size: 11px; color: #333; margin-top: 1px;">${company.address || ""} ${company.phone ? "โทร " + company.phone : ""}</div>
            <div style="font-size: 11px; color: #333;">เลขประจำตัวผู้เสียภาษีอากร: <b>${company.taxId || "-"}</b></div>
          </div>
          <div style="text-align: right; line-height: 1.35;">
            <div style="font-size: 16px; font-weight: bold; color: #000;">
              ${options?.title || "สารบัญและใบปะหน้าสรุปรายการจ่ายค่าจ้าง / หักภาษี ณ ที่จ่าย (50 ทวิ)"}
            </div>
            <div style="font-size: 11.5px; color: #333; margin-top: 2px;">
              ประจำงวด: <b style="color: #4338ca;">${monthText}</b> | จำนวนทั้งหมด <b>${dataList.length}</b> ฉบับ
            </div>
            <div style="font-size: 11px; color: #555; margin-top: 1px;">
              หน้า ${pageNum} / ${totalPages} | วันที่พิมพ์: ${new Date().toLocaleDateString("th-TH")}
            </div>
          </div>
        </div>

        <!-- Summary KPI Grid across Landscape Width -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; border: 1.2px solid #000; background: #fafafa; padding: 6px 10px; margin-bottom: 8px; border-radius: 4px;">
          <div>
            <div style="font-size: 11px; color: #555;">จำนวนเอกสาร</div>
            <div style="font-size: 15px; font-weight: bold; color: #000;">${dataList.length} <span style="font-size: 11px; font-weight: normal; color: #666;">ฉบับ</span></div>
            <div style="font-size: 11px; color: #666; margin-top: 1px;">บุคคลธรรมดา: ${countIndividual} | บริษัท: ${countCorporate}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #555;">รวมยอดค่าจ้าง (ก่อนหัก)</div>
            <div style="font-size: 15px; font-weight: bold; color: #0f172a;">฿${fmt(totalLabor)}</div>
            <div style="font-size: 11px; color: #666; margin-top: 1px;">บาท</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #555;">รวมภาษีหัก ณ ที่จ่าย 3%</div>
            <div style="font-size: 15px; font-weight: bold; color: #b91c1c;">฿${fmt(totalWht)}</div>
            <div style="font-size: 11px; color: #666; margin-top: 1px;">นำส่งสรรพากร</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #555;">ยอดจ่ายสุทธิรวม (คงเหลือ)</div>
            <div style="font-size: 15px; font-weight: bold; color: #047857;">฿${fmt(totalNet)}</div>
            <div style="font-size: 11px; color: #444; margin-top: 1px;">(${thaiBahtText(totalNet)})</div>
          </div>
        </div>
      `;
    } else {
      pageContent += `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1.5px solid #000; padding-bottom: 5px;">
          <div>
            <span style="font-size: 14px; font-weight: bold; color: #000;">
              ${options?.title || "สารบัญและใบปะหน้าสรุปรายการจ่ายค่าจ้าง"} (ต่อ)
            </span>
            <span style="font-size: 11.5px; color: #444; margin-left: 12px;">ประจำงวด: <b>${monthText}</b></span>
          </div>
          <div style="text-align: right; font-size: 11px; color: #555;">
            หน้า ${pageNum} / ${totalPages}
          </div>
        </div>
      `;
    }

    let tableRows = "";
    chunk.forEach((item, rIdx) => {
      let globalIdx = 0;
      for (let p = 0; p < pageIndex; p++) {
        globalIdx += pagesData[p].length;
      }
      globalIdx += rIdx + 1;

      const seqId = item.billSequence || globalIdx;
      const dateStr = item.billDate || item.rawBill?.["วันที่"] || "-";
      const name = item.contractor.fullName || item.rawBill?.["ชื่อ-นามสกุล"] || "-";
      const idCard = item.contractor.idCard || item.contractor.taxId || item.rawBill?.["เลขประจำตัวประชาชน"] || "-";
      const address = item.contractor.address || item.rawBill?.["ที่อยู่"] || "-";
      const wage = item.amounts.laborAndStaff || 0;
      const base003 = toNumber(item.rawBill?.["0.03"]) || wage;
      const rawWht3 = toNumber(item.rawBill?.["หัก 3%"]);
      // In the accounting file, "หัก 3%" stores the net payable amount after deducting 3%
      const netPayable = rawWht3 > (wage * 0.5) ? rawWht3 : (item.amounts.netPayable || wage);

      // ผู้ออก คือ ผู้สร้างบิลตั้งเบิก
      const rawIssuer = String(
        item.issuer ||
          item.rawBill?.["ผู้สร้างบิล"] ||
          item.rawBill?.["ผู้สร้างบิลตั้งเบิก"] ||
          item.rawBill?.["ผู้เบิก"] ||
          item.rawBill?.["ชื่อผู้เบิก"] ||
          item.rawBill?.requester ||
          item.rawBill?.requester_name ||
          item.rawBill?.["ผู้ออก"] ||
          item.rawBill?.["คนทำเอกสาร"] ||
          item.rawBill?.["ผู้จ่าย"] ||
          "-"
      ).trim();
      const issuer = rawIssuer && rawIssuer !== "" ? rawIssuer : "-";
      const jobDesc = item.jobDescription || item.rawBill?.["ชื่องาน หรือ หมายเหตุ"] || item.rawBill?.["รายละเอียดงาน"] || "-";
      const statusLabor = item.rawBill?.["Statusค่าแรง"] || item.rawBill?.["statusค่าแรง"] || (item.contractor.isCorporate ? "บริษัท" : "บุคคลธรรมดา");

      tableRows += `
        <tr style="height: 25px; font-size: 11px;">
          <td style="border: 1px solid #000; text-align: center; font-weight: 500; padding: 2px;">${seqId}</td>
          <td style="border: 1px solid #000; text-align: center; white-space: nowrap; padding: 2px;">${dateStr}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${name}">${name}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 10.5px; white-space: nowrap; padding: 2px;">${idCard}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${address}">${address}</td>
          <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-weight: 500;">${fmt(wage)}</td>
          <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-weight: 500;">${fmt(base003)}</td>
          <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-weight: bold; color: #065f46;">${fmt(netPayable)}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 10.5px; padding: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${issuer}</td>
          <td style="border: 1px solid #000; padding: 2px 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${jobDesc}">${jobDesc}</td>
          <td style="border: 1px solid #000; text-align: center; font-size: 10.5px; padding: 2px; white-space: nowrap;">${statusLabor}</td>
        </tr>
      `;
    });

    let tableFooter = "";
    if (isLastPage) {
      tableFooter = `
        <tfoot>
          <tr style="background: #f1f5f9; font-weight: bold; height: 28px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;">
            <td colspan="5" style="border: 1px solid #000; text-align: center; font-size: 11px; padding: 0 6px;">
              รวมทั้งสิ้น (${dataList.length} รายการ) — ${thaiBahtText(totalNet)}
            </td>
            <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-size: 11px;">฿${fmt(totalLabor)}</td>
            <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-size: 11px;">฿${fmt(totalBase003)}</td>
            <td style="border: 1px solid #000; text-align: right; padding: 2px 4px; font-size: 11px; color: #065f46;">฿${fmt(totalNet)}</td>
            <td colspan="3" style="border: 1px solid #000; text-align: center; font-size: 11px; color: #333;">บาท</td>
          </tr>
        </tfoot>
      `;
    }

    pageContent += `
      <table style="width: 100%; border-collapse: collapse; border: 1.2px solid #000; table-layout: fixed; margin-bottom: 8px; font-size: 11px; box-sizing: border-box;">
        <colgroup>
          <col style="width: 4.5%;" />
          <col style="width: 7.5%;" />
          <col style="width: 13.5%;" />
          <col style="width: 12%;" />
          <col style="width: 16.5%;" />
          <col style="width: 7.5%;" />
          <col style="width: 7.5%;" />
          <col style="width: 8%;" />
          <col style="width: 5.5%;" />
          <col style="width: 11%;" />
          <col style="width: 7%;" />
        </colgroup>
        <thead>
          <tr style="background: #e2e8f0; height: 28px; font-size: 11px; border-bottom: 1.2px solid #000;">
            <th style="border: 1px solid #000; text-align: center;">id</th>
            <th style="border: 1px solid #000; text-align: center;">วันที่</th>
            <th style="border: 1px solid #000; text-align: center;">ชื่อ-นามสกุล</th>
            <th style="border: 1px solid #000; text-align: center;">เลขประจำตัวประชาชน</th>
            <th style="border: 1px solid #000; text-align: center;">ที่อยู่</th>
            <th style="border: 1px solid #000; text-align: center;">ค่าจ้าง</th>
            <th style="border: 1px solid #000; text-align: center;">0.03</th>
            <th style="border: 1px solid #000; text-align: center;">หัก 3%</th>
            <th style="border: 1px solid #000; text-align: center;">ผู้ออก</th>
            <th style="border: 1px solid #000; text-align: center;">ชื่องาน หรือ หมายเหตุ</th>
            <th style="border: 1px solid #000; text-align: center;">Statusค่าแรง</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        ${tableFooter}
      </table>
    `;


    if (isLastPage) {
      pageContent += `
        <!-- 3 Executive Signatures Block across Landscape Width -->
        <div style="margin-top: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; font-size: 11px; line-height: 1.6;">
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 8px; background: #fafafa;">
            <div style="font-weight: bold; margin-bottom: 20px;">ผู้จัดทำเอกสาร</div>
            <div>ลงชื่อ ...........................................................</div>
            <div style="margin-top: 4px;">( ........................................................... )</div>
            <div style="color: #666; font-size: 11px; margin-top: 4px;">วันที่ ..... / ..... / .........</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 8px; background: #fafafa;">
            <div style="font-weight: bold; margin-bottom: 20px;">ผู้ตรวจสอบบัญชี / ภาษี</div>
            <div>ลงชื่อ ...........................................................</div>
            <div style="margin-top: 4px;">( ........................................................... )</div>
            <div style="color: #666; font-size: 11px; margin-top: 4px;">วันที่ ..... / ..... / .........</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 8px; background: #fafafa;">
            <div style="font-weight: bold; margin-bottom: 20px;">ผู้อนุมัติการจ่ายเงิน</div>
            <div>ลงชื่อ ...........................................................</div>
            <div style="margin-top: 4px;">( ........................................................... )</div>
            <div style="color: #666; font-size: 11px; margin-top: 4px;">วันที่ ..... / ..... / .........</div>
          </div>
        </div>
      `;
    }

    htmlPages += `<div class="a4-page a4-page-index">${pageContent}</div>`;
  });

  return htmlPages;
}

export function renderBillDocumentHtml(
  data: BillDocumentModel,
  pageMode: BillDocumentPageMode = "all"
): string {
  return renderMultipleBillsDocumentHtml([data], pageMode);
}

export function renderMultipleBillsDocumentHtml(
  dataList: BillDocumentModel[],
  pageMode: BillDocumentPageMode = "all",
  options?: { monthLabel?: string; title?: string }
): string {
  if (!dataList || dataList.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8" />${DOCUMENT_PAGE_STYLES}</head><body><div class="a4-document-container"><div class="a4-page" style="display:flex;align-items:center;justify-content:center;color:#666;">ไม่พบข้อมูลเอกสาร</div></div></body></html>`;
  }

  let allPagesHtml = "";

  if (pageMode === "index" || pageMode === "all_with_index") {
    allPagesHtml += renderDocumentIndexHtml(dataList, options);
  }

  if (pageMode !== "index") {
    for (let idx = 0; idx < dataList.length; idx++) {
      const data = dataList[idx];
      const replacements = buildTemplateReplacements(data);

      let p1 = PAGE_1_HTML_TEMPLATE;
      let p2 = PAGE_2_HTML_TEMPLATE;
      let p3 = PAGE_3_HTML_TEMPLATE;

      for (const [key, value] of Object.entries(replacements)) {
        const placeholder = `<<[${key}]>>`;
        p1 = p1.split(placeholder).join(String(value ?? ""));
        p2 = p2.split(placeholder).join(String(value ?? ""));
        p3 = p3.split(placeholder).join(String(value ?? ""));
      }

      if (pageMode === "all" || pageMode === "all_with_index" || pageMode === "contract") {
        allPagesHtml += `<div class="a4-page a4-page-1" data-bill="${data.billSequence}">${p1}</div>`;
      }
      if (pageMode === "all" || pageMode === "all_with_index" || pageMode === "voucher") {
        allPagesHtml += `<div class="a4-page a4-page-2" data-bill="${data.billSequence}">${p2}</div>`;
      }
      if (pageMode === "all" || pageMode === "all_with_index" || pageMode === "tax50twi") {
        allPagesHtml += `<div class="a4-page a4-page-3" data-bill="${data.billSequence}">${p3}</div>`;
      }
    }
  }

  const docTitle =
    pageMode === "index"
      ? `สารบัญสรุปรายการ (${dataList.length} รายการ)`
      : dataList.length === 1
      ? `เอกสารบิล #${dataList[0].billSequence}`
      : `ชุดเอกสาร (${dataList.length} รายการ)`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  ${DOCUMENT_PAGE_STYLES}
  ${pageMode === "index" ? "<style>@page { size: A4 landscape !important; margin: 6mm 8mm 6mm 8mm !important; } .a4-page-index { width: 297mm !important; max-width: 297mm !important; }</style>" : ""}
</head>
<body>
  <div class="a4-document-container">
    ${allPagesHtml}
  </div>
</body>
</html>`;
}
