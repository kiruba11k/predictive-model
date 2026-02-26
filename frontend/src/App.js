import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Predictor from "./components/Predictor";
import Dashboard from "./components/Dashboard";
import Particles from "./components/Particles";
import "./App.css";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`app ${scrolled ? "scrolled" : ""}`}>
      <Particles />
      <Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <main className={`main ${sidebarOpen ? "sidebar-active" : ""}`}>
        <div className="content-wrapper">
          <Dashboard />
          <Predictor />
        </div>
      </main>
    </div>
  );
}
