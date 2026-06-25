/**
 * Builds an ESC/POS byte stream for a thermal receipt and returns it base64
 * encoded, ready to hand to the native BluetoothPrinter plugin.
 *
 * Mirrors the on-screen ThermalReceipt layout, but in plain ESC/POS so it
 * prints on any 58mm/80mm SPP printer. Amounts are suffixed with "DA"
 * (Algerian Dinar) in plain ASCII to stay within the printer's code page.
 */
import { format } from 'date-fns';

interface ReceiptStore {
  name?: string;
  address?: string;
  gstin?: string;
  phone?: string;
}

const ESC = 0x1b;
const GS = 0x1d;

class EscPosBuilder {
  private bytes: number[] = [];
  constructor(private width: number) {}

  private raw(...b: number[]) {
    for (const x of b) this.bytes.push(x & 0xff);
  }

  /** Append ASCII text (non-ASCII collapses to '?' for the printer code page). */
  private ascii(text: string) {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      this.bytes.push(code <= 0x7f ? code : 0x3f);
    }
  }

  init() {
    this.raw(ESC, 0x40); // ESC @  — reset printer
    return this;
  }

  align(mode: 'left' | 'center' | 'right') {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    this.raw(ESC, 0x61, n); // ESC a n
    return this;
  }

  bold(on: boolean) {
    this.raw(ESC, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  /** 'normal' | 'wide' (double width+height). */
  size(mode: 'normal' | 'wide') {
    this.raw(GS, 0x21, mode === 'wide' ? 0x11 : 0x00); // GS ! n
    return this;
  }

  text(s: string) {
    this.ascii(s);
    return this;
  }

  line(s = '') {
    this.ascii(s);
    this.raw(0x0a);
    return this;
  }

  /** Left text and right text justified to the configured column width. */
  pair(left: string, right: string) {
    const max = this.width;
    let l = left;
    if (l.length + right.length + 1 > max) {
      l = l.slice(0, Math.max(0, max - right.length - 1));
    }
    const gap = Math.max(1, max - l.length - right.length);
    return this.line(l + ' '.repeat(gap) + right);
  }

  rule() {
    return this.line('-'.repeat(this.width));
  }

  feed(n: number) {
    for (let i = 0; i < n; i++) this.raw(0x0a);
    return this;
  }

  cut() {
    this.raw(GS, 0x56, 0x01); // GS V 1 — partial cut (ignored by cutter-less printers)
    return this;
  }

  base64(): string {
    let bin = '';
    for (const b of this.bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }
}

function money(n: number): string {
  return (Number(n) || 0).toFixed(2) + ' DA';
}

export function buildReceiptEscPos(
  order: any,
  store: ReceiptStore | null | undefined,
  options?: { width?: number },
): string {
  // 32 columns prints cleanly on both 58mm and 80mm printers.
  const width = options?.width ?? 32;
  const s = store || {};
  const b = new EscPosBuilder(width);

  b.init().align('center');

  b.bold(true).size('wide').line(s.name || 'LOOMPOS').size('normal').bold(false);
  if (s.address) {
    for (const part of String(s.address).split('\n')) {
      if (part.trim()) b.line(part.trim());
    }
  }
  if (s.gstin) b.line('GSTIN: ' + s.gstin);
  if (s.phone) b.line('Ph: ' + s.phone);

  b.align('left').rule();
  b.line('Inv : ' + order.invoiceNo);
  b.line('Date: ' + format(new Date(order.date), 'dd/MM/yy HH:mm'));
  if (order.customerName) b.line('Cust: ' + order.customerName);
  if (order.customerMobile) b.line('Mob : ' + order.customerMobile);
  b.rule();

  for (const item of order.items || []) {
    b.line(item.product?.name || 'Item');
    b.pair(`  ${item.quantity} x ${money(item.price)}`, money(item.price * item.quantity));
  }

  b.rule();
  b.pair('Subtotal', money(order.totalAmount - order.gstAmount));
  b.pair('GST', money(order.gstAmount));
  b.bold(true).size('wide').pair('TOTAL', money(order.totalAmount)).size('normal').bold(false);
  b.rule();
  b.line('Paid via: ' + order.paymentMethod);

  b.align('center').feed(1);
  b.bold(true).line('Thank You!').bold(false);
  b.line('Visit again for more trends');
  b.feed(3).cut();

  return b.base64();
}
