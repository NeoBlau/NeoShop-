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
import { ModerationPage } from './routes/admin/ModerationPage.js';
import { SuppliersPage } from './routes/admin/SuppliersPage.js';
import { PavilionsPage } from './routes/admin/PavilionsPage.js';
import { AuditPage } from './routes/admin/AuditPage.js';
import { MetricsPage } from './routes/admin/MetricsPage.js';
import { NotFoundPage } from './routes/NotFoundPage.js';
import { CartPage } from './routes/CartPage.js';
import { CheckoutPage } from './routes/CheckoutPage.js';
import { OrdersPage } from './routes/OrdersPage.js';
import { OrderStatusPage } from './routes/OrderStatusPage.js';
import { SupplierOrdersPage } from './routes/supplier/SupplierOrdersPage.js';
import { WorldPage } from './routes/WorldPage.js';
import { CatalogPage } from './routes/CatalogPage.js';
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
          path="checkout"
          element={
            <RequireAuth>
              <CheckoutPage />
            </RequireAuth>
          }
        />
        <Route
          path="orders"
          element={
            <RequireAuth>
              <OrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="orders/:number"
          element={
            <RequireAuth>
              <OrderStatusPage />
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
          path="supplier/orders"
          element={
            <RequireRole roles={['SUPPLIER', 'ADMIN']}>
              <SupplierOrdersPage />
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
        {(
          [
            ['admin/moderation', <ModerationPage key="moderation" />],
            ['admin/suppliers', <SuppliersPage key="suppliers" />],
            ['admin/pavilions', <PavilionsPage key="pavilions" />],
            ['admin/audit', <AuditPage key="audit" />],
            ['admin/metrics', <MetricsPage key="metrics" />],
          ] as const
        ).map(([path, element]) => (
          <Route
            key={path}
            path={path}
            element={<RequireRole roles={['ADMIN']}>{element}</RequireRole>}
          />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
