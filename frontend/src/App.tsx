import axios from "axios";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { ShoppingListsPage } from "@/features/shopping/ShoppingListsPage";
import { ShoppingListDetailPage } from "@/features/shopping/ShoppingListDetailPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { ChatWidget } from "@/features/chat/ChatWidget";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route element={<AppShell />}>
                <Route path="/shopping" element={<ShoppingListsPage />} />
                <Route
                  path="/shopping/:id"
                  element={<ShoppingListDetailPage />}
                />
                <Route path="/tasks" element={<TasksPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/shopping" replace />} />
          </Routes>
          <ChatWidget />
        </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
