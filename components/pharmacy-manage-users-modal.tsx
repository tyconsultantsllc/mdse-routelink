"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, UserPlus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PharmacyManageUsersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pharmacyId: string | null
  pharmacyName: string
}

const emptyForm = { firstName: "", lastName: "", email: "", phone: "", password: "" }

// Was previously a "Manage Users" button that popped a toast claiming to
// open user management and did nothing - no way to see or change who has
// portal access for a pharmacy. This lists the real pharmacy_users rows for
// a pharmacy and lets an admin add or remove access, reusing the same
// createUser/deleteUser actions the main Users page already uses.
export function PharmacyManageUsersModal({ open, onOpenChange, pharmacyId, pharmacyName }: PharmacyManageUsersModalProps) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const { toast } = useToast()

  useEffect(() => {
    if (open && pharmacyId) {
      fetchUsers()
    } else {
      setShowAddForm(false)
      setForm(emptyForm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pharmacyId])

  const fetchUsers = async () => {
    if (!pharmacyId) return
    setLoading(true)
    try {
      const { getPharmacyUsers } = await import("@/app/actions/data-actions")
      const data = await getPharmacyUsers(pharmacyId)
      setUsers(data || [])
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load pharmacy users", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pharmacyId) return
    setIsCreating(true)
    try {
      const { createUser } = await import("@/app/actions/data-actions")
      await createUser({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: "pharmacy",
        pharmacyId,
      })
      toast({
        title: "User added",
        description: `${form.firstName} ${form.lastName} can now sign in to ${pharmacyName}'s portal.`,
      })
      setForm(emptyForm)
      setShowAddForm(false)
      fetchUsers()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add user", variant: "destructive" })
    } finally {
      setIsCreating(false)
    }
  }

  const handleRemove = async (userId: string, label: string) => {
    // deleteUser removes the whole account, not just this pharmacy's access
    // to it - worth spelling out before a single click does something this
    // hard to undo.
    if (
      !confirm(`Remove ${label}'s access to ${pharmacyName}? This permanently deletes their account and can't be undone.`)
    )
      return
    setRemovingId(userId)
    try {
      const { deleteUser } = await import("@/app/actions/data-actions")
      await deleteUser(userId)
      toast({ title: "Access removed", description: `${label} can no longer sign in.` })
      fetchUsers()
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to remove user", variant: "destructive" })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Users — {pharmacyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No user accounts for this pharmacy yet.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((u) => {
                const name = `${u.users?.first_name || ""} ${u.users?.last_name || ""}`.trim() || u.users?.email
                return (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-2 border rounded-md">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.users?.email}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(u.id, name)}
                      disabled={removingId === u.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {showAddForm ? (
            <form onSubmit={handleAddUser} className="space-y-3 border-t pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pu-first">First Name *</Label>
                  <Input
                    id="pu-first"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="pu-last">Last Name *</Label>
                  <Input
                    id="pu-last"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="pu-email">Email *</Label>
                <Input
                  id="pu-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pu-phone">Phone</Label>
                <Input
                  id="pu-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pu-password">Temporary Password *</Label>
                <Input
                  id="pu-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Share this with them directly - there's no invite email yet.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} disabled={isCreating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Adding..." : "Add User"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="border-t pt-4">
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
