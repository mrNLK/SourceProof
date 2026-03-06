import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/Toast";
import Dashboard from "./views/Dashboard";
import ReviewQueue from "./views/ReviewQueue";
import ReviewDetail from "./views/ReviewDetail";
import Documents from "./views/Documents";
import Corpus from "./views/Corpus";
import Monitors from "./views/Monitors";

export default function App() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reviews" element={<ReviewQueue />} />
          <Route path="/reviews/:id" element={<ReviewDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/corpus" element={<Corpus />} />
          <Route path="/monitors" element={<Monitors />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}
