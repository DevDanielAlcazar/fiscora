import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AdminWebhookPage from "./pages/AdminWebhookPage";
import AdminModulesPage from "./pages/AdminModulesPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminPlansPage from "./pages/AdminPlansPage";
import AdminXmlAnalysesPage from "./pages/AdminXmlAnalysesPage";
import AdminXmlAnalysisBatchesPage from "./pages/AdminXmlAnalysisBatchesPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import BillingSuccessPage from "./pages/BillingSuccessPage";
import BillingCancelPage from "./pages/BillingCancelPage";
import PlansPage from "./pages/PlansPage";
import XmlAuditPage from "./pages/XmlAuditPage";
import XmlAuditHistoryPage from "./pages/XmlAuditHistoryPage";
import XmlAuditZipBatchesPage from "./pages/XmlAuditZipBatchesPage";
import LaborPage from "./pages/LaborPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/admin/stripe-webhook" element={<AdminWebhookPage />} />
      <Route path="/admin/modules" element={<AdminModulesPage />} />
      <Route path="/admin/users" element={<AdminUsersPage />} />
      <Route path="/admin/plans" element={<AdminPlansPage />} />
      <Route path="/admin/xml-analyses" element={<AdminXmlAnalysesPage />} />
      <Route path="/admin/xml-analysis-batches" element={<AdminXmlAnalysisBatchesPage />} />
      <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      <Route path="/billing/cancel" element={<BillingCancelPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/modules/xml-audit" element={<XmlAuditPage />} />
      <Route path="/modules/xml-audit/history" element={<XmlAuditHistoryPage />} />
      <Route path="/modules/xml-audit/history/batches" element={<XmlAuditZipBatchesPage />} />
      <Route path="/modules/labor" element={<LaborPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
