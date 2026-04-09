/**
 * Hardware Abstraction Layer (HAL)
 * 
 * This service abstracts browser-specific APIs (like window.print) 
 * so they can be easily swapped for native Tauri APIs when 
 * transitioning to a Desktop application.
 */

export const hardware = {
  /**
   * Triggers a system print dialog.
   * In a browser, this calls window.print().
   * In Tauri, this would call the printer plugin.
   */
  print: async () => {
    // Current Browser implementation
    window.print();
    
    // Future Tauri implementation example (commented out):
    // import { print } from 'tauri-plugin-printer-js';
    // await print({ ... });
  },

  /**
   * Triggers a cash drawer kick (if supported by hardware).
   */
  kickCashDrawer: async () => {
    console.log('[Hardware] Kicking Cash Drawer...');
    // This typically requires a low-level command to the printer (ESC/POS)
  },

  /**
   * Listener for barcode scanner inputs.
   * Most scanners act as keyboard emulators (HID).
   */
  onBarcodeScan: (callback: (barcode: string) => void) => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // Scanners are fast; if time between keys is > 50ms, it's likely a human typing
      if (currentTime - lastKeyTime > 50) {
        buffer = '';
      }

      if (e.key === 'Enter') {
        if (buffer.length > 2) {
          callback(buffer);
        }
        buffer = '';
      } else if (e.key.length === 1) {
        buffer += e.key;
      }

      lastKeyTime = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }
};
