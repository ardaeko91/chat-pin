# PIN Chat (BBM Style WhatsApp)

Aplikasi chat real-time ringan dengan tampilan mirip WhatsApp namun menggunakan sistem **PIN Unik (BBM Style)** tanpa nomor HP/WA.

## Struktur Project
```text
Chat (Apk)/
├── backend/          # Node.js + Express + Socket.io + SQLite
└── frontend/         # React (Vite) + Tailwind CSS + Capacitor (Android)
```

---

## 1. Cara Menjalankan Secara Lokal (Local Development)

### **A. Jalankan Backend**
1. Buka terminal, masuk ke folder `backend`:
   ```bash
   cd backend
   npm install
   npm start
   ```
   Server akan berjalan di port `3001`.

### **B. Jalankan Frontend**
1. Buka terminal baru, masuk ke folder `frontend`:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Buka browser di `http://localhost:3000`.

---

## 2. Cara Deploy ke Hosting cPanel Exabytes

### **A. Deploy Backend (Node.js App di cPanel)**
1. Login ke **cPanel Exabytes** Anda.
2. Cari menu **"Setup Node.js App"**.
3. Klik **Create Application**:
   - Node.js version: Pilih versi stabil (misal: 18.x atau 20.x).
   - Application mode: `production`.
   - Application root: `backend` (atau folder tempat file backend di-upload).
   - Application startup file: `server.js`.
4. Upload semua file dari folder `backend` ke folder aplikasi di cPanel (kecuali `node_modules`).
5. Di terminal cPanel (atau tombol **Run NPM Install**), jalankan:
   ```bash
   npm install
   ```
6. Klik **Start App**. Catat port atau domain yang diberikan (atau arahkan subdomain seperti `chat-api.namadomain.com` ke port backend).

### **C. Deploy Frontend (React Build)**
1. Sesuaikan URL backend di frontend (jika domain API terpisah, update `BACKEND_URL` di `frontend/src/App.jsx`).
2. Build frontend untuk production:
   ```bash
   cd frontend
   npm run build
   ```
3. Hasil build ada di folder `frontend/dist/`.
4. Upload isi folder `dist` tersebut ke folder `public_html` di cPanel Exabytes (atau subdomain tujuan, misal `chat.namadomain.com`).

---

## 3. Cara Build Aplikasi Android (APK)

Jika Anda ingin membungkus web chat ini menjadi aplikasi Android (APK):
1. Pastikan **Android Studio** terinstal di komputer Anda.
2. Buka folder frontend di terminal:
   ```bash
   cd frontend
   npx cap open android
   ```
3. Android Studio akan terbuka dengan project Android Capacitor.
4. Di Android Studio, klik **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. APK siap di-install di HP Android!
