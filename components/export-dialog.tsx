"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { FileText, FileSpreadsheet, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV, generateReportHTML, printReport } from "@/lib/export-utils"

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: "deliveries" | "performance" | "drivers" | "pharmacies"
  data: any
}

export function ExportDialog({ open, onOpenChange, reportType, data }: ExportDialogProps) {
  const { toast } = useToast()
  const [format, setFormat] = useState("pdf")
  const [includeCharts, setIncludeCharts] = useState(true)
  const [includeSummary, setIncludeSummary] = useState(true)

  const handleExport = () => {
    if (format === "csv") {
      // Export as CSV
      let csvData: Record<string, any>[] = []
      let filename = ""

      switch (reportType) {
        case "deliveries":
          csvData = data.deliveries || []
          filename = "deliveries-report"
          break
        case "performance":
          csvData = data.performance || []
          filename = "performance-report"
          break
        case "drivers":
          csvData = data.drivers || []
          filename = "drivers-report"
          break
        case "pharmacies":
          csvData = data.pharmacies || []
          filename = "pharmacies-report"
          break
      }

      exportToCSV(csvData, filename)

      toast({
        title: "Export Successful",
        description: `${filename}.csv has been downloaded`,
      })
    } else {
      // Export as PDF (using print dialog)
      const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`

      let reportContent = ""

      if (includeSummary) {
        reportContent += `
          <h2>Summary</h2>
          <div class="stats-grid">
            ${
              data.stats
                ? data.stats
                    .map(
                      (stat: any) => `
              <div class="stat-card">
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value}</div>
              </div>
            `,
                    )
                    .join("")
                : ""
            }
          </div>
        `
      }

      reportContent += `
        <h2>Detailed Data</h2>
        <table>
          <thead>
            <tr>
              ${data.headers ? data.headers.map((header: string) => `<th>${header}</th>`).join("") : ""}
            </tr>
          </thead>
          <tbody>
            ${
              data.rows
                ? data.rows
                    .map(
                      (row: any[]) => `
              <tr>
                ${row.map((cell) => `<td>${cell}</td>`).join("")}
              </tr>
            `,
                    )
                    .join("")
                : ""
            }
          </tbody>
        </table>
      `

      const html = generateReportHTML(reportTitle, reportContent)
      printReport(html)

      toast({
        title: "Opening Print Dialog",
        description: "Save as PDF from the print dialog",
      })
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>Choose your export format and options</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={setFormat}>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent cursor-pointer">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileText className="h-4 w-4" />
                  <div>
                    <p className="font-medium">PDF Document</p>
                    <p className="text-xs text-muted-foreground">Best for sharing and printing</p>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent cursor-pointer">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer flex-1">
                  <FileSpreadsheet className="h-4 w-4" />
                  <div>
                    <p className="font-medium">CSV Spreadsheet</p>
                    <p className="text-xs text-muted-foreground">Best for data analysis</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {format === "pdf" && (
            <div className="space-y-3">
              <Label>Export Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="summary"
                    checked={includeSummary}
                    onCheckedChange={(checked) => setIncludeSummary(checked as boolean)}
                  />
                  <Label htmlFor="summary" className="text-sm font-normal cursor-pointer">
                    Include summary statistics
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="charts"
                    checked={includeCharts}
                    onCheckedChange={(checked) => setIncludeCharts(checked as boolean)}
                  />
                  <Label htmlFor="charts" className="text-sm font-normal cursor-pointer">
                    Include charts and graphs
                  </Label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
