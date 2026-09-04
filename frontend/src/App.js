import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";

// ---- Public website (Daneswara Print landing) ----
import LandingShell from "@/landing/LandingShell";
import Landing from "@/landing/pages/Landing";
import GalleryPage from "@/landing/pages/GalleryPage";
import PriceList from "@/landing/pages/PriceList";
import PriceListPrintOnly from "@/landing/pages/PriceListPrintOnly";
import Order from "@/landing/pages/Order";

// ---- DanesPOS dashboard ----
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Products from "@/pages/Products";
import Categories from "@/pages/Categories";
import Inventory from "@/pages/Inventory";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";
import Settings from "@/pages/Settings";
import Customers from "@/pages/Customers";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Orders from "@/pages/Orders";
import RiwayatTransaksi from "@/pages/RiwayatTransaksi";
import Expenses from "@/pages/Expenses";
import OtherIncome from "@/pages/OtherIncome";
import ExportData from "@/pages/ExportData";
import GalleryManager from "@/pages/GalleryManager";

// POS route group: mounts the dashboard toaster only for POS pages (landing has its own).
function PosShell() {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public website */}
              <Route element={<LandingShell />}>
                <Route path="/" element={<Landing />} />
                <Route path="/galeri" element={<GalleryPage />} />
                <Route path="/gallery" element={<GalleryPage />} />
                <Route path="/price-list" element={<PriceList />} />
                <Route path="/price-list-print-only" element={<PriceListPrintOnly />} />
                <Route path="/order" element={<Order />} />
              </Route>
              <Route path="/admin" element={<Navigate to="/login" replace />} />

              {/* DanesPOS */}
              <Route element={<PosShell />}>
              <Route path="/login" element={<Login />} />
              <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="produk" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Products /></ProtectedRoute>} />
                <Route path="kategori" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Categories /></ProtectedRoute>} />
                <Route path="inventory" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Inventory /></ProtectedRoute>} />
                <Route path="pelanggan" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><Customers /></ProtectedRoute>} />
                <Route path="pesanan" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><Orders /></ProtectedRoute>} />
                <Route path="riwayat" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><RiwayatTransaksi /></ProtectedRoute>} />
                <Route path="supplier" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Suppliers /></ProtectedRoute>} />
                <Route path="pembelian" element={<ProtectedRoute roles={["Owner", "Manager", "Gudang"]}><Purchases /></ProtectedRoute>} />
                <Route path="pengeluaran" element={<ProtectedRoute roles={["Owner", "Manager"]}><Expenses /></ProtectedRoute>} />
                <Route path="pendapatan-lain" element={<ProtectedRoute roles={["Owner", "Manager"]}><OtherIncome /></ProtectedRoute>} />
                <Route path="laporan" element={<ProtectedRoute roles={["Owner", "Manager"]}><Reports /></ProtectedRoute>} />
                <Route path="ekspor" element={<ProtectedRoute roles={["Owner"]}><ExportData /></ProtectedRoute>} />
                <Route path="galeri-web" element={<ProtectedRoute roles={["Owner", "Manager"]}><GalleryManager /></ProtectedRoute>} />
                <Route path="pengguna" element={<ProtectedRoute roles={["Owner", "Manager"]}><Users /></ProtectedRoute>} />
                <Route path="pengaturan" element={<ProtectedRoute roles={["Owner", "Manager", "Kasir"]}><Settings /></ProtectedRoute>} />
              </Route>
              </Route>

              {/* Legacy dashboard paths -> /app/* */}
              {["produk", "kategori", "inventory", "pelanggan", "pesanan", "riwayat", "supplier", "pembelian", "pengeluaran", "pendapatan-lain", "laporan", "ekspor", "pengguna", "pengaturan"].map((p) => (
                <Route key={p} path={`/${p}`} element={<Navigate to={`/app/${p}`} replace />} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
