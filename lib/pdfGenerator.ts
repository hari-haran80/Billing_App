// lib/pdfGenerator.ts - Updated for bottle support
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { BillData } from './types/bill';

export class PDFGenerator {
  /**
   * Generate HTML for receipt with bottle support
   */
  private static generateReceiptHTML(bill: BillData, language: 'tamil' | 'english' = 'tamil'): string {
    const date = new Date(bill.date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const day = dayNames[date.getDay()];
    
    // Group items by type
    const weightItems = bill.items.filter(item => item.unitType === 'weight');
    const bottleItems = bill.items.filter(item => item.unitType === 'count');
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 10px; 
            max-width: 200px;
            margin: 0 auto;
            font-size: 12px;
          }
          .header { 
            text-align: center; 
            border-bottom: 1px solid #333; 
            padding-bottom: 10px; 
            margin-bottom: 15px; 
          }
          .company-name { 
            color: #2c3e50; 
            margin: 0; 
            font-size: 16px;
            font-weight: bold;
          }
          .bill-title { 
            color: #16a085; 
            margin: 5px 0; 
            font-size: 14px;
          }
          .bill-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 15px;
            flex-wrap: wrap;
          }
          .customer-info { 
            background: #f8f9fa; 
            padding: 8px; 
            border-radius: 4px;
            flex: 1;
            margin-right: 10px;
            min-width: 150px;
          }
          .date-info {
            background: #e3f2fd;
            padding: 8px;
            border-radius: 4px;
            min-width: 120px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 10px 0; 
            font-size: 11px;
          }
          th { 
            background: #2c3e50; 
            color: white; 
            padding: 6px; 
            text-align: left; 
            font-size: 10px;
          }
          td { 
            padding: 6px; 
            border-bottom: 1px solid #ddd; 
            font-size: 10px;
          }
          .total-row { 
            background: #ecf0f1; 
            font-weight: bold; 
            font-size: 16px;
          }
          .section-title {
            background: #f8f9fa;
            padding: 6px;
            font-weight: bold;
            color: #495057;
            margin-top: 10px;
            border-radius: 3px;
            font-size: 11px;
          }
          .footer { 
            text-align: center; 
            margin-top: 20px; 
            color: #7f8c8d; 
            font-size: 10px; 
          }
          .hidden-note { 
            color: #e74c3c; 
            font-size: 12px; 
            margin-top: 20px; 
            font-style: italic;
          }
          .tamil-text {
            font-family: Arial, sans-serif;
          }
          .signature {
            margin-top: 40px;
            border-top: 1px dashed #333;
            padding-top: 20px;
            text-align: center;
          }
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="company-name">Famous Scraps</h1>
          <h2 class="bill-title">SCRAP BILLING RECEIPT</h2>
          <p>Bill No: <strong>${bill.billNumber}</strong></p>
        </div>
        
        <div class="bill-info">
          <div class="customer-info">
            <h3>Customer Details</h3>
            <p><strong>Name:</strong> ${bill.customerName}</p>
            ${bill.customerPhone ? `<p><strong>Phone:</strong> ${bill.customerPhone}</p>` : ''}
          </div>
          <div class="date-info">
            <p><strong>Date:</strong> ${date.toLocaleDateString()}</p>
            <p><strong>Day:</strong> ${day}</p>
            <p><strong>Time:</strong> ${date.toLocaleTimeString()}</p>
          </div>
        </div>
        
        ${bottleItems.length > 0 ? `
          <div class="section-title">${language === 'tamil' ? 'பாட்டில்கள் (எண்ணும் பொருட்கள்)' : 'Bottles (Count Items)'}</div>
          <table>
            <thead>
              <tr>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '1. பாட்டில் வகை' : '1. Bottle Type'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '2. எண்ணிக்கை' : '2. Quantity'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '3. அலகு விலை ₹' : '3. Unit Price ₹'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '4. மொத்த விலை ₹' : '4. Total ₹'}</th>
              </tr>
            </thead>
            <tbody>
              ${bottleItems.map(item => `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.quantity}</td>
                  <td>${item.pricePerUnit?.toFixed(2) || '0.00'}</td>
                  <td>${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        
        ${weightItems.length > 0 ? `
          ${bottleItems.length > 0 ? `<div class="section-title">${language === 'tamil' ? 'எடை பொருட்கள்' : 'Weight Items'}</div>` : ''}
          <table>
            <thead>
              <tr>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '1. பொருளின் பெயர்' : '1. Item Name'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '2. அலகு விலை ₹' : '2. Unit Price ₹'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '3. எடை கி.கி' : '3. Weight kg'}</th>
                <th class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? '4. மொத்த விலை ₹' : '4. Total ₹'}</th>
              </tr>
            </thead>
            <tbody>
              ${weightItems.map(item => `
                <tr>
                  <td>${item.itemName}</td>
                  <td>${item.pricePerKg?.toFixed(2) || '0.00'}</td>
                  <td>${item.finalWeight?.toFixed(2) || '0.00'}</td>
                  <td>${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
              
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">
                  <strong class="${language === 'tamil' ? 'tamil-text' : ''}">${language === 'tamil' ? 'மொத்த தொகை:' : 'Total Amount:'}</strong>
                </td>
                <td><strong>₹ ${bill.totalAmount.toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        ` : ''}
        
        <div class="signature">
          <p>Customer Signature: ___________________</p>
          <p style="margin-top: 20px;">Authorized Signature: ___________________</p>
        </div>
        
        <div class="footer">
          <p><strong>Famous Scraps</strong></p>
          <p>Thank you for your business!</p>
          <p>This is a computer-generated receipt, valid without signature</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate and save PDF locally
   */
  static async generatePDF(bill: BillData, language: 'tamil' | 'english' = 'tamil'): Promise<string> {
    try {
      const html = this.generateReceiptHTML(bill, language);
      
      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      
      // For now, return the temporary URI directly
      // File system operations can be unreliable across platforms
      console.log('PDF generated at temporary location:', uri);
      return uri;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  /**
   * Share PDF with other apps
   */
  static async sharePDF(pdfUri: string): Promise<void> {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Bill Receipt',
        UTI: 'com.adobe.pdf'
      });
    }
  }

  /**
   * List all saved PDFs
   */
  static async listPDFs(): Promise<string[]> {
    try {
      const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory!);
      return files.filter(file => file.endsWith('.pdf'));
    } catch (error) {
      console.error('Error listing PDFs:', error);
      return [];
    }
  }
}