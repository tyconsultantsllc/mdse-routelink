// Utility functions for exporting data to CSV and PDF formats

import { saveOrShareFile, isNativeApp, type SaveOrShareResult } from "@/lib/native-file"

export async function exportToCSV(data: Record<string, any>[], filename: string): Promise<SaveOrShareResult | void> {
  if (data.length === 0) return

  // Get headers from the first object
  const headers = Object.keys(data[0])

  // Create CSV content
  const csvContent = [
    headers.join(","),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          // Escape commas and quotes in values
          if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(","),
    ),
  ].join("\n")

  // On regular web this downloads a .csv the usual way; inside the wrapped
  // Android app (where a plain download silently does nothing) it opens the
  // OS share sheet instead so the file can be saved or shared.
  return saveOrShareFile(csvContent, `${filename}.csv`, "text/csv;charset=utf-8;")
}

export function generateReportHTML(title: string, data: any) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            color: #333;
          }
          h1 {
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
          }
          h2 {
            color: #1e40af;
            margin-top: 30px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
          }
          .date {
            color: #666;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: 600;
            color: #1f2937;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 20px 0;
          }
          .stat-card {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
          }
          .stat-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 5px;
          }
          .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #111827;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🚚 MDSE RouteLink</div>
          <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
        </div>
        ${data}
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} MDSE RouteLink. All rights reserved.</p>
          <p>This report is confidential and intended for internal use only.</p>
        </div>
      </body>
    </html>
  `
}

export async function printReport(html: string): Promise<SaveOrShareResult> {
  if (isNativeApp()) {
    // window.open("", "_blank") for a second window isn't supported inside
    // the wrapped app's WebView (it needs custom native code to handle new
    // windows, which this app doesn't have) - it would just silently return
    // null, so the print dialog would never appear. Instead, hand the report
    // off as an .html file through the share sheet: the person can open it
    // in a real browser to print/save as PDF from there, or just share it.
    await saveOrShareFile(html, `report-${Date.now()}.html`, "text/html")
    return { method: "share" }
  }

  const printWindow = window.open("", "_blank")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()

    // Wait for content to load before printing
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
  return { method: "download" }
}
