import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import JoinTrip from './pages/JoinTrip';
import TripActive from './pages/TripActive';
import TripResults from './pages/TripResults';
import TripLobby from './components/trip/TripLobby';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import { useAuthSync } from './hooks/useAuthSync';

export default function App() {
  useAuthSync();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join/:shareToken" element={<JoinTrip />} />
        <Route path="/trip/:shareToken/lobby" element={<TripLobby />} />
        <Route path="/trip/:shareToken/active" element={<TripActive />} />
        <Route path="/trip/:shareToken/results" element={<TripResults />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
