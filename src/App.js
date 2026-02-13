import { Link, Navigate, Route, Routes } from "react-router-dom";
import CreateEventPage from "./pages/CreateEventPage";
import EventPage from "./pages/EventPage";

function App() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">
            FindTime
          </Link>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<CreateEventPage />} />
          <Route path="/event/:eventId" element={<EventPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
