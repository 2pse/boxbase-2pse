import { useState, useEffect, useRef } from "react"
import { Capacitor } from "@capacitor/core"
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser"
import { BarcodeScanner } from "@capacitor-community/barcode-scanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface QRCodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (result: string) => void
  expectedText?: string
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  open,
  onOpenChange,
  onScanSuccess,
  expectedText = "Open Gym Check-In"
}) => {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const isNative = Capacitor.isNativePlatform()

  useEffect(() => {
    if (open) {
      startScan()
    } else {
      stopAll()
    }

    return () => {
      stopAll()
    }
  }, [open])


  const startScan = async () => {
    try {
      setError(null)

      // Web/PWA fallback
      if (!isNative) {
        await startWebScan()
        return
      }

      // Native (Capacitor) scanning
      setScanning(true)
      const status = await BarcodeScanner.checkPermission({ force: true })
      
      if (status.granted) {
        BarcodeScanner.hideBackground()
        
        const result = await BarcodeScanner.startScan()
        
        if (result.hasContent) {
          handleScanResult(result.content)
        }
      } else {
        setError("Kamera-Berechtigung erforderlich")
        toast({
          title: "Berechtigung erforderlich",
          description: "Bitte erlaube den Zugriff auf die Kamera für QR-Code-Scanning.",
          variant: "destructive"
        })
      }
    } catch (err) {
      console.error("Error starting scan:", err)
      setError("Scanner konnte nicht gestartet werden")
      toast({
        title: "Scanner-Fehler",
        description: "QR-Code-Scanner konnte nicht gestartet werden.",
        variant: "destructive"
      })
    } finally {
      if (isNative) setScanning(false)
    }
  }


  const stopScan = async () => {
    try {
      await BarcodeScanner.stopScan()
      BarcodeScanner.showBackground()
    } catch (err) {
      console.error("Error stopping scan:", err)
    }
  }

  const startWebScan = async () => {
    try {
      setScanning(true)

      // 1) Get camera stream explicitly so the preview is visible
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        try { await videoRef.current.play() } catch {}
      }

      // 2) Start ZXing decoder using the already playing video element
      const codeReader = new BrowserMultiFormatReader()
      codeReaderRef.current = codeReader

      const controls = await codeReader.decodeFromVideoElement(
        videoRef.current!,
        (result, err) => {
          if (result) {
            handleScanResult(result.getText())
          }
          // ignore err (not found) to keep scanning
        }
      )
      controlsRef.current = controls
    } catch (err) {
      console.error("Error starting web scan:", err)
      setError("Scanner konnte im Browser nicht gestartet werden")
      toast({
        title: "Scanner-Fehler",
        description: "QR-Code-Scanner konnte im Browser nicht gestartet werden.",
        variant: "destructive"
      })
      setScanning(false)
    }
  }

  const stopWebScan = () => {
    try {
      controlsRef.current?.stop()
      codeReaderRef.current = null
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    } catch (err) {
      console.error("Error stopping web scan:", err)
    } finally {
      setScanning(false)
    }
  }

  const stopAll = async () => {
    if (isNative) {
      await stopScan()
    }
    stopWebScan()
  }

  const handleScanResult = (content: string) => {
    console.log("QR Code gescannt:", content)
    console.log("Erwartet:", expectedText)
    
    // Clean up both strings for comparison
    const cleanContent = content.trim().toLowerCase()
    const cleanExpected = expectedText.trim().toLowerCase()
    
    // Check if content contains or matches the expected text
    if (cleanContent === cleanExpected || cleanContent.includes(cleanExpected.replace(/\s+/g, ''))) {
      stopAll()
      onScanSuccess(content)
      onOpenChange(false)
      toast({
        title: "QR-Code gescannt",
        description: "Open Gym Check-In erfolgreich!",
        variant: "default"
      })
    } else {
      console.log("QR-Code Inhalt stimmt nicht überein")
      toast({
        title: "Falscher QR-Code",
        description: `Gescannt: "${content}" - Erwartet: "${expectedText}"`,
        variant: "destructive"
      })
    }
  }

  const handleClose = () => {
    stopAll()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Camera className="h-5 w-5" />
            QR-Code Scanner
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            Scanne den QR-Code am Empfang für deinen Open Gym Check-In
          </p>
          
          {error && (
            <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          
          {scanning && (
            <div className="text-sm text-muted-foreground">
              Scanner läuft... Richte die Kamera auf den QR-Code.
            </div>
          )}

          {!isNative && (
            <div className="rounded-md overflow-hidden bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-64 object-cover"
              />
            </div>
          )}
          
          <div className="flex gap-2 justify-center">

            <Button 
              variant="outline" 
              onClick={handleClose}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Abbrechen
            </Button>
            
            {!scanning && (
              <Button 
                onClick={startScan}
                className="flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Erneut scannen
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}