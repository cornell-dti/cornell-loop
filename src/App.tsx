import Admin from "./pages/Admin";
import DesignSystem from "./pages/DesignSystem";

function App() {
  if (window.location.pathname === "/admin") return <Admin />;

  return <DesignSystem />;
}

export default App;
