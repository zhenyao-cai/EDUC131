import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { AppHome } from "@/pages/AppHome";
import { ClassDetail } from "@/pages/ClassDetail";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { ProjectEditor } from "@/pages/ProjectEditor";
import { PublicProject } from "@/pages/PublicProject";
import { Register } from "@/pages/Register";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <Routes>
          {/* Standalone: published site fills the window (no app chrome). */}
          <Route path="/p/:projectId" element={<PublicProject />} />
          {/* Full-screen HTML workspace (no app chrome). */}
          <Route path="/app/project/:projectId/html" element={<ProjectEditor />} />

          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/app" element={<AppHome />} />
            <Route path="/app/class/:classId" element={<ClassDetail />} />
            <Route path="/app/project/:projectId" element={<ProjectEditor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
