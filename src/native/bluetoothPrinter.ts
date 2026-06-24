/**
 * JS bridge to the native BluetoothPrinter plugin (classic SPP/RFCOMM).
 *
 * Only meaningful on the native Android build. On the web the methods reject,
 * so callers should gate on Capacitor.isNativePlatform() (see isPrinterSupported).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface PrinterDevice {
  name: string;
  address: string;
}

export interface BluetoothPrinterPlugin {
  /** Whether the device has a Bluetooth adapter and whether it is enabled. */
  isAvailable(): Promise<{ available: boolean; enabled: boolean }>;
  /** Paired/bonded devices the user can print to. */
  listPairedDevices(): Promise<{ devices: PrinterDevice[] }>;
  /** Sends a base64-encoded ESC/POS byte stream to the given device address. */
  print(options: { address: string; data: string }): Promise<{ success: boolean }>;
}

export const BluetoothPrinter = registerPlugin<BluetoothPrinterPlugin>('BluetoothPrinter');

export function isPrinterSupported(): boolean {
  return Capacitor.isNativePlatform();
}
