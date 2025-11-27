import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SaveTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (templateName: string) => Promise<void>
}

export const SaveTemplateDialog = ({ open, onOpenChange, onSave }: SaveTemplateDialogProps) => {
  const [templateName, setTemplateName] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!templateName.trim()) return
    
    setSaving(true)
    try {
      await onSave(templateName.trim())
      setTemplateName("")
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Template speichern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="z.B. Willkommens-Email"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!templateName.trim() || saving}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
