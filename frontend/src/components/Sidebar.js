import React from 'react';

const Sidebar = ({ open, setOpen }) => {
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'active' : ''}`} onClick={() => setOpen(false)} />
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Menu</h3>
          <button className="close-sidebar" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="sidebar-links">
          <a href="#" className="sidebar-link">
            <i>📊</i>
            <span>Dashboard</span>
          </a>
          <a href="#" className="sidebar-link">
            <i>🤖</i>
            <span>AI Predictor</span>
          </a>
          <a href="#" className="sidebar-link">
            <i>📈</i>
            <span>Analytics</span>
          </a>
          <a href="#" className="sidebar-link">
            <i>⚙️</i>
            <span>Settings</span>
          </a>
          <a href="#" className="sidebar-link">
            <i>📁</i>
            <span>Projects</span>
          </a>
          <a href="#" className="sidebar-link">
            <i>👥</i>
            <span>Team</span>
          </a>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
