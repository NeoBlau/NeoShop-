import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from './ui/AppShell.js';
import { RequireAuth, RequireRole } from './routes/guards.js';
import { LoginPage } from './routes/LoginPage.js';
import { RegisterPage } from './routes/RegisterPage.js';
import { SupplierDashboard } from './routes/SupplierDashboard.js';
import { ProductsPage } from './routes/supplier/ProductsPage.js';
import { ProductWizardPage } from './routes/supplier/ProductWizardPage.js';
import { ImportPage } from './routes/supplier/ImportPage.js';
import { StatsPage } from './routes/supplier/StatsPage.js';
import { AdminDashboard } from './routes/AdminDashboard.js';
import {
  CartPage,
  CatalogPage,
  NotFoundPage,
  OrdersPage,
  WorldPage,
} from './routes/buyer-pages.js';
import { useSession } from './stores/session.js';

export function App() {
  const bootstrap = useSession((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorldPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route
          path="orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="supplier"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <SupplierDashboard />
            </RequireRole>
          }
        />
        <Route
          path="supplier/products"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <ProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="supplier/products/new"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <ProductWizardPage />
            </RequireRole>
          }
        />
        <Route
          path="supplier/products/:id"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <ProductWizardPage />
            </RequireRole>
          }
        />
        <Route
          path="supplier/import"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <ImportPage />
            </RequireRole>
          }
        />
        <Route
          path="supplier/stats"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <StatsPage />
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole roles={['ADMIN']}>
              <AdminDashboard />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
