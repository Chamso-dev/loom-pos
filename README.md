<div align="center">
  <img src="public/favicon.svg" alt="LoomPOS Logo" width="96" height="96" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
</div>

# LoomPOS

### *Modern, Enterprise-Grade Point of Sale & Inventory Management System*

LoomPOS is a high-performance, single-store Point of Sale (POS) system engineered for rapid retail operations. Built with a sleek desktop-first design, LoomPOS features sub-second barcode checkout, dynamic tax breaks (GST), offline state syncing, real-time analytics, and secure admin gates.

---

<div align="center">

[![React](https://img.shields.io/badge/Frontend-React%2018-61DAFB?logo=react&logoColor=black&style=flat-square)](#)
[![Express](https://img.shields.io/badge/Backend-Express.js-000000?logo=express&logoColor=white&style=flat-square)](#)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white&style=flat-square)](#)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white&style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#)
[![Status](https://img.shields.io/badge/Status-Production--Ready-success?style=flat-square)](#)

[Live Demo](#) 

</div>

---

## 📷 Screenshots

| Admin Analytics & Reporting | POS Billing & UPI Checkout |
| :---: | :---: |
| ![Dashboard Screen](public/screens/dashboard.avif) <br> *Daily summaries, revenue analytics, and sales trends* | ![Billing Screen](public/screens/billing.avif) <br> *Sub-second scanning and dynamic UPI QR generation* |

---

## ✨ Features

* ⚡ **Sub-Second Checkout**: Optimized cart management with integrated hardware barcode scanner support, instant item matching, and a keyboard/SKU autocomplete dropdown featuring full arrow key navigation and instant select shortcuts.
* 📊 **Financial Analytics**: Real-time sales dashboards tracking daily revenue, order counts, tax aggregates, and 7-day performance logs.
* 🧾 **Compliant GST Engine**: Automatic tax calculation with real-time grouping by GST rates (5%, 12%, 18%, 28%) and invoice generation.
* 🖨️ **Multi-Format Printing**: Dedicated printing templates for standard 80mm thermal receipt printers and professional A4 tax invoices.
* 📲 **Dynamic UPI QR Codes**: Dynamically encodes store credentials and exact payable totals into instant, scan-to-pay QR codes.
* 🔒 **Multi-Tiered Security**: Granular, role-based access control (RBAC) separating administrative actions from cashier checkouts.
* 📦 **Barcode Sheet Generator**: Utility to configure and print customized barcode sheet layouts for product inventory tagging.

---

## 🛠️ Tech Stack

### Frontend
* **Core**: React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons
* **State Management**: Zustand (with persistent local storage caching)
* **Build System**: Vite

### Backend
* **Server**: Node.js, Express.js (TypeScript)
* **Runtime Runner**: TSX runtime watcher

### Database & ORM
* **Database**: PostgreSQL
* **ORM**: Prisma ORM (with native client query engine)

### Authentication & Validation
* **Security**: JSON Web Tokens (JWT), Bcrypt.js password hashing
* **Validation**: Zod Schemas (API payloads validation)

---

## 🏛️ Architecture Overview

LoomPOS utilizes a decoupled client-server architecture designed for high availability and low latency:

* **React Single Page Application**: Serves as the interactive desktop interface. Delegates state management (cart items, active sessions, and settings) to Zustand to avoid prop drilling and minimize re-renders.
* **RESTful API Backend**: A stateless Express.js server that validates payload structures using Zod schemas and processes queries via Prisma.
* **Transaction Safety**: All checkout operations run inside a database-level transaction (`prisma.$transaction`). If any product is out of stock or does not match inventory checks, the operation is rolled back, preventing partial writes.

---

## 📂 Project Structure

<details>
<summary><b>📂 View Project Structure Tree</b></summary>

```
loom-pos/
├── prisma/                  # Database configuration and migrations
│   ├── migrations/          # SQL database migration history
│   └── schema.prisma        # Prisma schema and relationship definitions
├── public/                  # Static public assets (custom favicon, logos)
├── scripts/                 # CLI utility scripts (DB verification, password resets)
├── server/                  # Backend REST API Server (Express.js)
│   └── index.ts             # API endpoints, middleware, and server bootstrap
├── src/                     # Frontend Client App (Vite + React)
│   ├── components/          # Component architecture
│   │   ├── auth/            # Auth gates & login screen
│   │   ├── billing/         # Checkout carts, QR codes, print engines
│   │   ├── dashboard/       # Sales charts & financial analytics
│   │   ├── inventory/       # Product grids & barcode generators
│   │   ├── layout/          # Application shell & sidebar layouts
│   │   └── settings/        # Store settings & cashier configurations
│   ├── hooks/               # Custom React hooks (global scanner)
│   ├── lib/                 # Shared helpers (Prisma clients, formatters)
│   ├── store/               # Zustand global store configuration
│   └── App.tsx              # Application router and guards
├── package.json             # Configuration scripts and dependencies
└── vite.config.ts           # Bundler configuration
```

</details>


## 🗄️ Database Schema Summary

The database consists of 5 core models structured for strict transaction isolation and audit compliance:

<details>
<summary><b>📐 View Entity-Relationship Diagram (ERD) & Schema Details</b></summary>

```mermaid
erDiagram
    User ||--o{ Order : processes
    Order ||--|{ OrderItem : contains
    Product ||--o{ OrderItem : details
    
    StoreSettings {
        String id PK
        String name
        String address
        String gstin
        String upiId
        String phone
        String cashierPassword
    }
    User {
        String id PK
        String employeeId UK
        String name
        String role
        String phone
        String password
        Boolean isActive
    }
    Product {
        String id PK
        String name
        String sku UK
        String barcode UK
        String category
        String size
        String color
        Float costPrice
        Float sellingPrice
        Float gst
        Int stock
        String supplier
    }
    Order {
        String id PK
        String invoiceNo UK
        DateTime date
        Float totalAmount
        Float gstAmount
        String paymentMethod
        String customerName
        String customerMobile
        String userId FK
    }
    OrderItem {
        String id PK
        String orderId FK
        String productId FK
        Int quantity
        Float price
    }
```

</details>

---

## 🚀 Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/loom-pos.git
cd loom-pos
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup database migrations
Configure your PostgreSQL URL (see the Environment Variables section below) and run:
```bash
npx prisma migrate dev --name init
```

### 4. Seed demo data
Populate the database with realistic products, staff accounts, and 7-day transaction logs to display graphics on the dashboard:
```bash
npm run seed
```

---

## 🔑 Environment Variables

Create a `.env` file in the root directory:

| Variable | Description | Default / Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/loompos?schema=public` |
| `JWT_SECRET` | Cryptographic secret for signing tokens | `super-secret-cryptographic-hash-key-here` |

---

## 💻 Running Locally

Start the development environment by launching the API backend and Vite client.

**1. Start the API Server:**
```bash
npx tsx watch server/index.ts
```
* Runs on `http://localhost:3001`
* Creates a default admin account on startup: **Employee ID:** `admin` / **Password:** `admin123`

**2. Start the Frontend Client:**
```bash
npm run dev
```
* Runs on `http://localhost:5173`

---

## 🔌 API Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate cashier/admin and retrieve JWT token | None |
| `POST` | `/api/auth/change-password` | Update current user password | Bearer JWT |
| `GET` | `/api/users` | List all staff members | Admin JWT |
| `POST` | `/api/users` | Register a new cashier or admin account | Admin JWT |
| `GET` | `/api/products` | Fetch paginated & searchable product catalog | None |
| `POST` | `/api/products` | Add new product to inventory | Admin Key / JWT |
| `PUT` | `/api/products/:id` | Modify an existing product catalog details | Admin Key / JWT |
| `DELETE` | `/api/products/:id` | Remove a product from catalog | Admin Key / JWT |
| `POST` | `/api/orders` | Create an invoice and update stock levels | None |
| `GET` | `/api/orders` | Query invoice transaction history (with filters) | None |
| `GET` | `/api/orders/:id` | Retrieve single transaction receipt details | None |
| `GET` | `/api/settings` | Get invoice metadata (GSTIN, UPI ID, Address) | None |
| `PUT` | `/api/settings` | Update company settings and company logo | Admin JWT |
| `GET` | `/api/analytics/summary` | Retrieve sales revenue, orders count, and GST summaries | None |
| `GET` | `/api/analytics/sales` | Retrieve 7-day revenue trend | None |
| `GET` | `/api/inventory/low-stock` | Retrieve products with stock level <= 10 | None |

---

## 📦 Core Modules

### 🛒 Checkout Engine
Processes incoming billing carts through isolated transactions (`prisma.$transaction`) to perform absolute safety checks on available stock. Features a search-by-keyword autocomplete dropdown with full keyboard navigation (arrows + Enter/Escape shortcuts) to enable high-speed checkout without needing a mouse.

### 📊 Reports & Analytics
Aggregates sales records directly from the database to present real-time dashboards of business indicators. Measures overall GST collections and tracks payment breakdowns across CASH, UPI, and CARD.

### 🏷️ Inventory & Barcode Preview
Manages catalog attributes, stock configurations, and barcode labeling. Emits preview components styled to match real-world layout printing specs.

---

## 🚀 Deployment

### 1. Compile client assets
Build the optimized static frontend bundle:
```bash
npm run build
```
*Frontend assets are built to `/dist`, ready to be served by Nginx, Cloudflare, or Netlify.*

### 2. Run API backend persistently
Serve the backend API under process manager monitoring (PM2):
```bash
pm2 start npx --name "loompos-api" -- tsx server/index.ts
```

---

## 🔒 Security Standards

* **Bcrypt Hashing**: All individual and global passwords are encrypted using Bcrypt with 10 salt rounds before database storage.
* **Token Integrity**: Authenticated routes verify session details using signed JSON Web Tokens expiring after 12 hours.
* **Admin Verification Overrides**: Non-admin users attempting catalog or system updates must supply an authorized admin key passphrase passed via the custom header `x-admin-verification-key`.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more details.
