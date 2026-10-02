/**
 * Sample data for the demo build and local screenshots only. The real app starts
 * empty; nothing here is loaded by the production server or seed.
 * Prices are typical Algerian shelf prices in dinars, tax included.
 */

export const demoStore = {
  name: 'Supérette El Baraka',
  address: '14 rue Larbi Ben M’hidi, Alger-Centre, Alger',
  phone: '0550123456',
  nif: '000016001234567',
  rc: '16/00-1234567 B 21',
  nis: '000116010012345',
  articleNo: '16012345678',
  ripAccount: '00799999001234567890',
  ribAccount: '00400123401234567890',
  receiptFooter: 'Merci de votre visite / شكرًا على زيارتكم',
}

export interface DemoProduct {
  name: string
  sku: string
  barcode: string
  category: string
  unit: 'piece' | 'kg' | 'g' | 'l' | 'ml' | 'box'
  size?: string
  costPrice: number
  sellingPrice: number
  taxRate: number
  stock: number
  supplier?: string
  /** Expiry date as days from today when the demo starts; negative means already expired. */
  expiresInDays?: number
}

export const demoProducts: DemoProduct[] = [
  { name: 'Semoule moyenne Sim 5 kg', sku: 'SEM-SIM-5', barcode: '6130001000017', category: 'Épicerie', unit: 'piece', size: '5 kg', costPrice: 560, sellingPrice: 650, taxRate: 0, stock: 34, supplier: 'Distribution Mitidja' },
  { name: 'Huile Elio 5 L', sku: 'HUI-ELIO-5', barcode: '6130002000014', category: 'Épicerie', unit: 'piece', size: '5 L', costPrice: 590, sellingPrice: 650, taxRate: 0, stock: 18, supplier: 'Distribution Mitidja' },
  { name: 'Sucre blanc', sku: 'SUC-VRAC', barcode: '2000003', category: 'Épicerie', unit: 'kg', costPrice: 85, sellingPrice: 95, taxRate: 0, stock: 60, supplier: 'Distribution Mitidja' },
  { name: 'Lait Candia 1 L', sku: 'LAIT-CAND-1', barcode: '6130004000018', category: 'Crèmerie', unit: 'piece', size: '1 L', costPrice: 120, sellingPrice: 140, taxRate: 0, stock: 48, supplier: 'Candia Algérie', expiresInDays: 9 },
  { name: 'Lben Soummam 1 L', sku: 'LBEN-SOU-1', barcode: '6130005000015', category: 'Crèmerie', unit: 'piece', size: '1 L', costPrice: 95, sellingPrice: 115, taxRate: 0, stock: 6, supplier: 'Soummam', expiresInDays: 2 },
  { name: 'Fromage Camembert Président', sku: 'FRO-CAM', barcode: '6130006000012', category: 'Crèmerie', unit: 'piece', costPrice: 260, sellingPrice: 320, taxRate: 19, stock: 14, expiresInDays: -3 },
  { name: 'Café Facto 250 g', sku: 'CAF-FAC-250', barcode: '6130007000019', category: 'Épicerie', unit: 'piece', size: '250 g', costPrice: 300, sellingPrice: 357, taxRate: 19, stock: 22, supplier: 'Distribution Mitidja', expiresInDays: 240 },
  { name: 'Thé vert Ksar 500 g', sku: 'THE-KSAR', barcode: '6130008000016', category: 'Épicerie', unit: 'piece', size: '500 g', costPrice: 420, sellingPrice: 520, taxRate: 19, stock: 9 },
  { name: 'Eau minérale Ifri 1,5 L', sku: 'EAU-IFRI-15', barcode: '6130009000013', category: 'Boissons', unit: 'piece', size: '1,5 L', costPrice: 32, sellingPrice: 45, taxRate: 9, stock: 120, supplier: 'Ifri' },
  { name: 'Hamoud Boualem Selecto 1 L', sku: 'HB-SEL-1', barcode: '6130010000019', category: 'Boissons', unit: 'piece', size: '1 L', costPrice: 95, sellingPrice: 130, taxRate: 19, stock: 40, expiresInDays: 75 },
  { name: 'Pack eau Ifri (6 × 1,5 L)', sku: 'EAU-IFRI-PK6', barcode: '6130009000020', category: 'Boissons', unit: 'box', size: '6 × 1,5 L', costPrice: 190, sellingPrice: 250, taxRate: 9, stock: 15, supplier: 'Ifri' },
  { name: 'Tomates', sku: 'LEG-TOM', barcode: '2000012', category: 'Légumes', unit: 'kg', costPrice: 160, sellingPrice: 250, taxRate: 0, stock: 42.5 },
  { name: 'Pommes de terre', sku: 'LEG-PDT', barcode: '2000013', category: 'Légumes', unit: 'kg', costPrice: 55, sellingPrice: 80, taxRate: 0, stock: 120 },
  { name: 'Oignons', sku: 'LEG-OIG', barcode: '2000014', category: 'Légumes', unit: 'kg', costPrice: 50, sellingPrice: 70, taxRate: 0, stock: 3.2 },
  { name: 'Bananes', sku: 'FRU-BAN', barcode: '2000015', category: 'Fruits', unit: 'kg', costPrice: 260, sellingPrice: 340, taxRate: 0, stock: 25 },
  { name: 'Dattes Deglet Nour', sku: 'FRU-DAT', barcode: '2000016', category: 'Fruits', unit: 'kg', costPrice: 650, sellingPrice: 900, taxRate: 0, stock: 12, expiresInDays: 150 },
  { name: 'Olives vertes en vrac', sku: 'VRAC-OLI', barcode: '2000017', category: 'Vrac', unit: 'g', costPrice: 0.6, sellingPrice: 0.9, taxRate: 0, stock: 4000, expiresInDays: 12 },
  { name: 'Baguette', sku: 'BOU-BAG', barcode: '2000018', category: 'Boulangerie', unit: 'piece', costPrice: 8.5, sellingPrice: 10, taxRate: 0, stock: 0 },
  { name: 'Lessive Isis 3 kg', sku: 'ENT-ISIS-3', barcode: '6130011000016', category: 'Entretien', unit: 'piece', size: '3 kg', costPrice: 690, sellingPrice: 820, taxRate: 19, stock: 11 },
  { name: 'Javel La Croix 1 L', sku: 'ENT-JAV-1', barcode: '6130012000013', category: 'Entretien', unit: 'piece', size: '1 L', costPrice: 75, sellingPrice: 95, taxRate: 19, stock: 26 },
]

export const demoCustomers = [
  { name: 'Karim Benali', phone: '0555123456', creditLimit: 10000 },
  { name: 'Amina Boudiaf', phone: '0661234567', creditLimit: 5000 },
  { name: 'Yacine Haddad', phone: '0770112233', creditLimit: null },
  { name: 'Nadia Cherif', phone: '021234567', creditLimit: 3000 },
  { name: 'Mohamed Saidi', phone: null, creditLimit: null },
]

export const demoSuppliers = [
  { name: 'Distribution Mitidja', phone: '0661223344', address: 'Zone industrielle, Blida' },
  { name: 'Candia Algérie', phone: '023456789', address: 'Bejaïa' },
  { name: 'Marché de gros El Harrach', phone: '0550998877', address: 'El Harrach, Alger' },
]

/** Busy hours for a neighbourhood supérette: morning bread rush, lunch, and after work. */
export const demoHourWeights: Record<number, number> = { 7: 4, 8: 6, 9: 4, 10: 3, 11: 4, 12: 5, 13: 3, 14: 2, 15: 2, 16: 3, 17: 6, 18: 8, 19: 7, 20: 4, 21: 2 }
