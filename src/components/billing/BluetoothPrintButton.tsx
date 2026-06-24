import { useState } from 'react'
import { Bluetooth, Loader2, CheckCircle2, AlertTriangle, X, Printer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'
import {
  BluetoothPrinter,
  isPrinterSupported,
  type PrinterDevice,
} from '@/native/bluetoothPrinter'
import { buildReceiptEscPos } from '@/native/escpos'

interface BluetoothPrintButtonProps {
  order: any
}

type Phase = 'idle' | 'loading' | 'list' | 'printing' | 'done' | 'error'

export default function BluetoothPrintButton({ order }: BluetoothPrintButtonProps) {
  const { settings } = useStore()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [message, setMessage] = useState<string>('')

  // The button only renders on the native build (see guard below), but keep the
  // hooks unconditional so React's hook order stays stable.
  if (!isPrinterSupported()) return null

  const openPicker = async () => {
    setOpen(true)
    setPhase('loading')
    setMessage('')
    try {
      const availability = await BluetoothPrinter.isAvailable()
      if (!availability.available) {
        setPhase('error')
        setMessage('This device has no Bluetooth adapter.')
        return
      }
      if (!availability.enabled) {
        setPhase('error')
        setMessage('Bluetooth is turned off. Enable it and try again.')
        return
      }
      const { devices: paired } = await BluetoothPrinter.listPairedDevices()
      setDevices(paired)
      setPhase('list')
      if (paired.length === 0) {
        setMessage('No paired printers found. Pair your printer in Android settings first.')
      }
    } catch (err: any) {
      setPhase('error')
      setMessage(err?.message || 'Could not access Bluetooth.')
    }
  }

  const printTo = async (device: PrinterDevice) => {
    setPhase('printing')
    setMessage(`Sending to ${device.name}...`)
    try {
      const data = buildReceiptEscPos(order, settings)
      await BluetoothPrinter.print({ address: device.address, data })
      setPhase('done')
      setMessage(`Printed to ${device.name}.`)
    } catch (err: any) {
      setPhase('error')
      setMessage(err?.message || 'Printing failed.')
    }
  }

  const close = () => {
    setOpen(false)
    setPhase('idle')
    setMessage('')
  }

  return (
    <>
      <button
        onClick={openPicker}
        className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white font-semibold text-xs rounded hover:opacity-90 transition-all cursor-pointer"
      >
        <Bluetooth size={14} />
        Bluetooth Print
      </button>

      {open && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans">
          <div className="bg-card w-full max-w-xs rounded-lg border border-border shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/50">
              <div className="flex items-center gap-2">
                <Bluetooth size={16} className="text-sky-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider">Thermal Printer</h2>
              </div>
              <button onClick={close} className="p-1.5 hover:bg-accent rounded border border-border bg-card">
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 min-h-[120px]">
              {phase === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Loader2 size={22} className="animate-spin" />
                  <span className="text-xs">Looking for paired printers...</span>
                </div>
              )}

              {phase === 'printing' && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
                  <Printer size={22} className="animate-pulse" />
                  <span className="text-xs">{message}</span>
                </div>
              )}

              {phase === 'done' && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-emerald-500">
                  <CheckCircle2 size={26} />
                  <span className="text-xs font-medium text-center">{message}</span>
                </div>
              )}

              {phase === 'error' && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-destructive">
                  <AlertTriangle size={24} />
                  <span className="text-xs font-medium text-center">{message}</span>
                </div>
              )}

              {phase === 'list' && (
                <div className="space-y-2">
                  {devices.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{message}</p>
                  ) : (
                    <>
                      <p className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground px-1">
                        Paired devices
                      </p>
                      {devices.map((device) => (
                        <button
                          key={device.address}
                          onClick={() => printTo(device)}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-border bg-accent/10 hover:bg-accent/40 transition-colors text-left"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold truncate">{device.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{device.address}</span>
                          </div>
                          <Printer size={14} className="text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {(phase === 'error' || phase === 'done' || (phase === 'list' && devices.length === 0)) && (
              <div className="p-3 border-t border-border bg-secondary/30 flex gap-2">
                <button
                  onClick={openPicker}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-semibold rounded border border-border bg-card hover:bg-accent transition-colors',
                  )}
                >
                  Retry
                </button>
                <button
                  onClick={close}
                  className="flex-1 px-3 py-2 text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
