import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { InstructorAuthProvider } from "@/contexts/InstructorAuthContext";
import { SessionProvider } from "@/contexts/SessionContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ClassGallery } from "@/pages/ClassGallery";
import { InstructorDashboard } from "@/pages/InstructorDashboard";
import { Landing } from "@/pages/Landing";
import { ProjectEditor } from "@/pages/ProjectEditor";
import { PublicProject } from "@/pages/PublicProject";
import { StudentWorkspace } from "@/pages/StudentWorkspace";

function StudentApp() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/p/:projectId" element={<PublicProject />} />
        <Route path="/app/project/:projectId/html" element={<ProjectEditor />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<StudentWorkspace />} />
          <Route path="/app/gallery" element={<ClassGallery />} />
          <Route path="/app/project/:projectId" element={<ProjectEditor />} />
          <Route path="/login" element={<Navigate to="/app" replace />} />
          <Route path="/register" element={<Navigate to="/app" replace />} />
          <Route path="/app/class/:classId" element={<Navigate to="/app/gallery" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
      </Routes>
    </SessionProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route
            path="/instructor"
            element={
              <InstructorAuthProvider>
                <InstructorDashboard />
              </InstructorAuthProvider>
            }
          />
          <Route path="/*" element={<StudentApp />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
