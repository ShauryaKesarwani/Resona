import { useEffect, useRef, useState } from 'react'

type Detector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> }
declare const BarcodeDetector: { new (options: { formats: string[] }): Detector } | undefined

/** Reads a QR code with the back camera. Not every browser can do this, so typing the code always works too. */
export function QrScanner({ onCode, onFail }: { onCode: (code: string) => void; onFail: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    let stream: MediaStream | undefined
    let timer: number | undefined

    async function run() {
      if (typeof BarcodeDetector === 'undefined') return onFail()
      const detector = new BarcodeDetector({ formats: ['qr_code'] })
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (!active || !video.current) return
      video.current.srcObject = stream
      await video.current.play()
      setReady(true)
      const look = async () => {
        if (!active || !video.current) return
        const found = await detector.detect(video.current).catch(() => [])
        if (found[0] && active) return onCode(found[0].rawValue)
        timer = window.setTimeout(look, 200)
      }
      look()
    }

    run().catch(() => active && onFail())
    return () => {
      active = false
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [onCode, onFail])

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-raised">
      <video ref={video} muted playsInline aria-label="Camera view" className={`aspect-square w-full object-cover ${ready ? '' : 'opacity-0'}`} />
    </div>
  )
}
