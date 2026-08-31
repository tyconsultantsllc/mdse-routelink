"use client"

import { UserPlus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AddDriverModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddDriverModal({ open, onOpenChange }: AddDriverModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-4">
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Add New Driver</DialogTitle>
        </DialogHeader>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" placeholder="First name" />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" placeholder="Last name" />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@example.com" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" type="tel" placeholder="(555) 123-4567" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vehicle">Vehicle Make/Model</Label>
              <Input id="vehicle" placeholder="Ford Transit" />
            </div>
            <div>
              <Label htmlFor="plate">License Plate</Label>
              <Input id="plate" placeholder="NY 12345" />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Driver
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
