import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AdminWebhookPage from "./pages/AdminWebhookPage";
import BillingSuccessPage from "./pages/BillingSuccessPage";
import BillingCancelPage from "./pages/BillingCancelPage";
import PlansPage from "./pages/PlansPage";
import XmlAuditPage from "./pages/XmlAuditPage";
import LaborPage from "./pages/LaborPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/admin/stripe-webhook" element={<AdminWebhookPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      <Route path="/billing/cancel" element={<BillingCancelPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/modules/xml-audit" element={<XmlAuditPage />} />
      <Route path="/modules/labor" element={<LaborPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
