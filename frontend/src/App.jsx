import { Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import AgentLayout from './components/AgentLayout.jsx';
import ClientLayout from './components/ClientLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AgentLogin from './pages/agent/Login.jsx';
import Dashboard from './pages/agent/Dashboard.jsx';
import FaceToFace from './pages/agent/FaceToFace.jsx';
import VirtualCall from './pages/agent/VirtualCall.jsx';
import ChatReview from './pages/agent/ChatReview.jsx';
import MetricsDashboard from './pages/agent/MetricsDashboard.jsx';
import KnowledgeLibrary from './pages/agent/KnowledgeLibrary.jsx';
import PolicyCompare from './pages/agent/PolicyCompare.jsx';
import ClientHome from './pages/client/ClientHome.jsx';
import ClientCall from './pages/client/ClientCall.jsx';
import ClientChat from './pages/client/ClientChat.jsx';
import ClientProfile from './pages/client/ClientProfile.jsx';
import PolicyDetail from './pages/client/PolicyDetail.jsx';
import CustomerPlan from './pages/agent/CustomerPlan.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* Agent Console */}
      <Route path="/agent/login" element={<AgentLogin />} />
      <Route
        path="/agent"
        element={
          <ProtectedRoute>
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="metrics" element={<MetricsDashboard />} />
        <Route path="knowledge" element={<KnowledgeLibrary />} />
        <Route path="compare" element={<PolicyCompare />} />
        <Route path="customers/:customerId/plan" element={<CustomerPlan />} />
        <Route path="session/:conversationId/face-to-face" element={<FaceToFace />} />
        <Route path="session/:conversationId/virtual-call" element={<VirtualCall />} />
        <Route path="session/:conversationId/chat" element={<ChatReview />} />
      </Route>

      {/* Client Portal (customer-facing demo) - shares ClientLayout so an
          incoming-call alert can surface on any of these screens. */}
      <Route path="/client" element={<ClientLayout />}>
        <Route index element={<ClientHome />} />
        <Route path="profile" element={<ClientProfile />} />
        <Route path="policy/:policyId" element={<PolicyDetail />} />
        <Route path="call/:conversationId" element={<ClientCall />} />
        <Route path="chat/:conversationId" element={<ClientChat />} />
      </Route>

      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
