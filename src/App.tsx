import { Route, Routes } from "react-router-dom";
import AppNav from "./components/AppNav";
import HistoryPage from "./pages/HistoryPage";
import HomePage from "./pages/HomePage";
import ReviewPage from "./pages/ReviewPage";
import SettingsPage from "./pages/SettingsPage";
import UpdatePage from "./pages/UpdatePage";

export default function App() {
  document.documentElement.lang = "ar";
  document.documentElement.dir = "rtl";

  return (
    <div className="app-shell">
      <main className="page-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/update" element={<UpdatePage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <AppNav />
    </div>
  );
}
