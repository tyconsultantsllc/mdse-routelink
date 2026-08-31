"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from 'lucide-react'

interface AddressAutocompleteInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export function AddressAutocompleteInput({
  id,
  value,
  onChange,
  placeholder,
  required
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    
    try {
      // Using Nominatim (OpenStreetMap) geocoding API - free and no API key required
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'PharmaTrack/1.0'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        const addresses = data.map((item: any) => item.display_name)
        setSuggestions(addresses)
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error("[v0] Address search error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    // Debounce search
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      searchAddress(newValue)
    }, 500)
  }

  const handleSelectSuggestion = (suggestion: string) => {
    onChange(suggestion)
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className="relative" ref={inputRef}>
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
