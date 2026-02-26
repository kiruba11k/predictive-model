import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Predictor from "./components/Predictor";
import Dashboard from "./components/Dashboard";
import BulkAnalyzer from "./components/BulkAnalyzer";
import Particles from "./components/Particles";
import "./App.css";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'

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
          
          <div className="analyzer-tabs">
            <button 
              className={`analyzer-tab ${activeTab === 'single' ? 'active' : ''}`}
              onClick={() => setActiveTab('single')}
            >
              Single Analysis
            </button>
            <button 
              className={`analyzer-tab ${activeTab === 'bulk' ? 'active' : ''}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Analysis
            </button>
          </div>

          {activeTab === 'single' ? <Predictor /> : <BulkAnalyzer />}
        </div>
      </main>
    </div>
  );
}
