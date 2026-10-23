import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { OnboardingProvider } from '@/onboarding/OnboardingProvider';
import { MontyDataProvider } from '@/api/MontyDataProvider';
import OnboardingPage from '@/onboarding/pages/OnboardingPage';
import DashboardWrapper from '@/dashboard/DashboardWrapper';

export default function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <MontyDataProvider>
          <Routes>
            <Route path="/" element={<OnboardingPage />} />
            <Route path="/dashboard" element={<DashboardWrapper />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MontyDataProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}
