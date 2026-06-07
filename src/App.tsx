import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Floors from './pages/Floors';
import Contracts from './pages/Contracts';
import Tenants from './pages/Tenants';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Utilities from './pages/Utilities';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/floors" element={<Floors />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/tenants" element={<Tenants />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/utilities" element={<Utilities />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
