// lib/pdfGenerator.ts - Optimized for thermal printer (52mm width)
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { BillData } from "./types/bill";

export class PDFGenerator {
  /**
   * Generate HTML for receipt optimized for thermal printer
   */
  private static generateReceiptHTML(
    bill: BillData,
    language: "tamil" | "english" = "tamil"
  ): string {
    const date = new Date(bill.date);

    const tamilDays = [
      "ஞாயிற்றுக்கிழமை",
      "திங்கட்கிழமை",
      "செவ்வாய்க்கிழமை",
      "புதன்கிழமை",
      "வியாழக்கிழமை",
      "வெள்ளிக்கிழமை",
      "சனிக்கிழமை",
    ];

    const englishDays = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    const day =
      language === "tamil"
        ? tamilDays[date.getDay()]
        : englishDays[date.getDay()];

    const tamilDate = date.toLocaleDateString("ta-IN");

    // Group items
    const weightItems = bill.items.filter((i) => i.unitType === "weight");
    const bottleItems = bill.items.filter((i) => i.unitType === "count");

    // Subtotals
    const countSubTotal = bottleItems.reduce((s, i) => s + i.amount, 0);
    const weightSubTotal = weightItems.reduce((s, i) => s + i.amount, 0);

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=52mm" />

<style>
@page {
  size: 52mm auto;
  margin: 0;
}

body {
  width: 52mm;
  margin: 0 auto;
  padding: 2mm;
  font-family: Arial, sans-serif;
  font-size: 9px;
  color: #000;
  line-height: 1.2;
}

* {
  box-sizing: border-box;
  color: #000 !important;
  background: transparent !important;
}

.ohm-symbol {
  text-align: center;
  font-size: 16px;
  margin-bottom: 2mm;
}

.header-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 3mm;
  padding-bottom: 2mm;
  border-bottom: 1px dashed #000;
}

.bill-number {
  font-weight: bold;
  font-size: 10px;
}

.date-info {
  text-align: right;
  font-size: 8px;
}

.date-info .tamil {
  font-size: 9px;
  font-weight: bold;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px;
  margin-top: 2mm;
}

.items-table th {
  text-align: left;
  padding: 1mm;
  border-bottom: 1px solid #000;
}

.items-table td {
  padding: 1mm;
}

.items-table tr:last-child td {
  border-bottom: 1px solid #000;
}

.col-item { width: 40%; }
.col-price { width: 22%; text-align: right; }
.col-qty { width: 15%; text-align: center; }
.col-total { width: 23%; text-align: right; font-weight: bold; }

.col-item-w { width: 35%; }
.col-uprice { width: 20%; text-align: right; }
.col-weight { width: 20%; text-align: right; }
.col-total-w { width: 25%; text-align: right; font-weight: bold; }

.item-name {
  word-break: break-word;
}

.total-row td {
  border-top: 2px solid #000;
  font-weight: bold;
}

.total-amount {
  text-align: center;
  font-size: 11px;
  font-weight: bold;
  margin: 4mm 0;
  padding: 2mm 0;
  border-top: 1px solid #000;
  border-bottom: 1px solid #000;
}

.thank-you {
  text-align: center;
  font-size: 10px;
  font-weight: bold;
  margin-top: 6mm;
  padding-top: 3mm;
  border-top: 1px dashed #000;
}
</style>
</head>

<body>

<div class="ohm-symbol">ௐ</div>

<div class="header-row">
  <div class="bill-number">
    பில் எண்: ${bill.billNumber}
  </div>
  <div class="date-info">
    <div class="tamil">${tamilDate}</div>
    <div>${day}</div>
    <div>
      ${date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}
    </div>
  </div>
</div>

${
  bottleItems.length > 0
    ? `
<table class="items-table">
<thead>
<tr>
  <th class="col-item">பொருள்</th>
  <th class="col-price">விலை</th>
  <th class="col-qty">எண்</th>
  <th class="col-total">மொத்தம்</th>
</tr>
</thead>
<tbody>
${bottleItems
  .map(
    (item) => `
<tr>
  <td class="col-item item-name">${item.itemName}</td>
  <td class="col-price">₹${item.pricePerUnit?.toFixed(2) || "0.00"}</td>
  <td class="col-qty">${item.quantity}</td>
  <td class="col-total">₹${item.amount.toFixed(2)}</td>
</tr>
`
  )
  .join("")}
<tr class="total-row">
  <td colspan="3">Subtotal</td>
  <td class="col-total">₹${countSubTotal.toFixed(2)}</td>
</tr>
</tbody>
</table>
`
    : ""
}

${
  weightItems.length > 0
    ? `
<table class="items-table">
<thead>
<tr>
  <th class="col-item-w">பொருள்</th>
  <th class="col-uprice">விலை</th>
  <th class="col-weight">எடை</th>
  <th class="col-total-w">மொத்தம்</th>
</tr>
</thead>
<tbody>
${weightItems
  .map(
    (item) => `
<tr>
  <td class="col-item-w item-name">${item.itemName}</td>
  <td class="col-uprice">₹${item.pricePerKg?.toFixed(2) || "0.00"}</td>
  <td class="col-weight">${item.lWeight?.toFixed(2) || "0.00"}</td>
  <td class="col-total-w">₹${item.amount.toFixed(2)}</td>
</tr>
`
  )
  .join("")}
<tr class="total-row">
  <td colspan="3">Subtotal</td>
  <td class="col-total-w">₹${weightSubTotal.toFixed(2)}</td>
</tr>
</tbody>
</table>
`
    : ""
}

<div class="total-amount">
  மொத்த தொகை : ₹ ${bill.totalAmount.toFixed(2)}
</div>

<div class="thank-you">
  நன்றி மீண்டும் வருக
</div>

</body>
</html>
`;
  }

  /**
   * Generate PDF
   */
  static async generatePDF(
    bill: BillData,
    language: "tamil" | "english" = "tamil"
  ): Promise<string> {
    const html = this.generateReceiptHTML(bill, language);

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
      width: 198, // 52mm
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    return uri;
  }

  /**
   * Share PDF
   */
  static async sharePDF(pdfUri: string): Promise<void> {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: "பில் ரசீது",
        UTI: "com.adobe.pdf",
      });
    }
  }
}
