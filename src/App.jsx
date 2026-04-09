import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login.jsx';
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import ResearcherDashboard from "./components/Researcher/ResearcherDashboard.jsx";
import EvaluatorDashboard from "./components/EvaluatorDashboard.jsx";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/researcher-dashboard" element={<ResearcherDashboard />} />
        <Route path="/evaluator-dashboard" element={<EvaluatorDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;