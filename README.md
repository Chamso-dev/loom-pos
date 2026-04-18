# LoomPOS - Modern Point of Sale System

A professional, high-performance POS system designed for modern retail. Built with React, TypeScript, Express, and Prisma.

## 🚀 Quick Start Guide for Vendors

Follow these steps to set up LoomPOS on a new local machine.

### 1. Prerequisites
Ensure you have the following installed on the computer:
*   **Node.js** (Version 18.0.0 or higher) - [Download here](https://nodejs.org/)
*   **Terminal/Command Prompt** knowledge

### 2. Installation & Setup

1.  **Extract the Files**
    *   Unzip or clone the project folder to your desired location (e.g., `Desktop/loom-pos`).

2.  **Open Terminal**
    *   Open your terminal and navigate to the project folder:
    ```bash
    cd /path/to/loom-pos
    ```

3.  **Install Dependencies**
    *   Run the following command to install all necessary packages:
    ```bash
    npm install
    ```

4.  **Initialize Database**
    *   Set up the local database structure and generate the client:
    ```bash
    npx prisma generate
    npx prisma db push
    ```

### 3. Running the Application

You need to run **two** commands (in two separate terminal windows/tabs):

**Window 1: Start Backend Server**
```bash
# This starts the database and API server
npx tsx watch server/index.ts
```

**Window 2: Start Frontend UI**
```bash
# This starts the user interface
npm run dev
```

*   **Access the App**: Once both are running, open your web browser and go to:
    **`http://localhost:5173`**

---

## 🛠️ Configuration & Customization

### Default Login (Admin)
*   **Staff ID**: `ADM001` (or your configured admin ID)
*   **Password**: `admin123` (default)

### Database Location
The data is stored in a local file at: `prisma/dev.db`.
*   **Recommendation**: Regularly back up this file to a USB drive or cloud storage to prevent data loss.

## 📦 Production Deployment
To prepare the app for a faster, professional performance:
1.  Run `npm run build`
2.  Serve the `dist` folder using a static server (like Nginx or `serve`).
3.  Ensure the backend server is running on a persistent process (using `pm2`).

---
*Developed with ❤️ for LoomPOS.*
