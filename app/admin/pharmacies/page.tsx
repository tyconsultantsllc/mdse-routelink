"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Users, Trash2 } from 'lucide-react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdminSidebar } from "@/components/admin-sidebar"
import { AdminHeader } from "@/components/admin-header"
import { AddPharmacyModal } from "@/components/add-pharmacy-modal"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function PharmacyManagement() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { toast } = useToast()
  const [pharmacies, setPharmacies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPharmacies()
  }, [])

  const fetchPharmacies = async () => {
    try {
      const { getPharmacies } = await import("@/app/actions/data-actions")
      const data = await getPharmacies()
      
      setPharmacies(data || [])
    } catch (error) {
      console.error("Error fetching pharmacies:", error)
      toast({
        title: "Error",
        description: "Failed to load pharmacies",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditPharmacy = (pharmacyId: string, pharmacyName: string) => {
    toast({
      title: "Edit Pharmacy",
      description: `Opening editor for ${pharmacyName}`,
    })
  }

  const handleDeletePharmacy = async (pharmacyId: string, pharmacyName: string) => {
    try {
      const { createClient } = await import("@/lib/supabase/client")
      const supabase = createClient()
      const { error } = await supabase.from("pharmacies").delete().eq("id", pharmacyId)

      if (error) throw error

      toast({
        title: "Pharmacy Removed",
        description: `${pharmacyName} has been removed from the system`,
      })
      fetchPharmacies()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete pharmacy",
        variant: "destructive",
      })
    }
  }

  const handleManageUsers = (pharmacyId: string, pharmacyName: string) => {
    toast({
      title: "Manage Users",
      description: `Opening user management for ${pharmacyName}`,
    })
  }

  const handlePharmacyAdded = () => {
    fetchPharmacies()
    setIsModalOpen(false)
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <AdminSidebar />

        <div className="flex flex-col flex-1 overflow-hidden">
          <AdminHeader title="Pharmacy Management" />

          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Registered Pharmacies</h2>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Pharmacy
              </Button>
            </div>

            {loading ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Loading pharmacies...</p>
              </Card>
            ) : pharmacies.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No pharmacies found. Add your first pharmacy to get started.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Pharmacy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {pharmacies.map((pharmacy) => (
                      <tr key={pharmacy.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-primary font-bold">{pharmacy.name[0]}</span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-foreground">{pharmacy.name}</div>
                              <div className="text-sm text-muted-foreground">{pharmacy.license_number || "N/A"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-foreground">{pharmacy.address}</div>
                          {pharmacy.latitude && pharmacy.longitude && (
                            <div className="text-sm text-muted-foreground">
                              {pharmacy.latitude.toFixed(4)}, {pharmacy.longitude.toFixed(4)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-foreground">{pharmacy.phone}</div>
                          <div className="text-sm text-muted-foreground">{pharmacy.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2"
                                onClick={() => handleEditPharmacy(pharmacy.id, pharmacy.name)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit pharmacy details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="mr-2"
                                onClick={() => handleManageUsers(pharmacy.id, pharmacy.name)}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage users</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeletePharmacy(pharmacy.id, pharmacy.name)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete pharmacy</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>

        <AddPharmacyModal open={isModalOpen} onOpenChange={setIsModalOpen} onSuccess={handlePharmacyAdded} />
      </div>
    </TooltipProvider>
  )
}
