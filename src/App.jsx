import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/common/AppLayout.jsx";
import WizardPage from "./components/wizard/WizardPage.jsx";
import { PlanProvider } from "./context/PlanContext.jsx";
import { ProfileProvider, useProfile } from "./context/ProfileContext.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import GroceryPage from "./pages/GroceryPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { DiaryProvider } from "./context/DiaryContext.jsx";
import ProfileNeedsUpdate from "./components/common/ProfileNeedsUpdate.jsx";
import { normalizeProfile, validateProfile } from "./utils/calorieCalculator.js";

const DiaryPage = lazy(() => import("./pages/DiaryPage.jsx"));
const ReportsPage = lazy(() => import("./pages/ReportsPage.jsx"));

function ProtectedLayout() {
  const { profile } = useProfile();
  if (!profile) return <Navigate to="/wizard" replace />;
  const errors = validateProfile(normalizeProfile(profile));
  return Object.keys(errors).length ? <ProfileNeedsUpdate errors={errors} /> : <AppLayout />;
}

export default function App() {
  return <ProfileProvider><PlanProvider><DiaryProvider><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/wizard" element={<WizardPage />} />
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/grocery" element={<GroceryPage />} />
      <Route path="/favorites" element={<FavoritesPage />} />
      <Route path="/diary" element={<Suspense fallback={<div className="panel diary-route-loading" role="status">Loading your diary…</div>}><DiaryPage /></Suspense>} />
      <Route path="/reports" element={<Suspense fallback={<div className="panel diary-route-loading" role="status">Loading your reports…</div>}><ReportsPage /></Suspense>} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<HomePage />} />
  </Routes></DiaryProvider></PlanProvider></ProfileProvider>;
}
