import React from 'react';

const Navbar = ({ toggleSidebar, sidebarOpen }) => {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <button className="hamburger" onClick={toggleSidebar}>
          <span>☰</span>
        </button>
        <div className="logo">Predictive Account AI </div>
      </div>
      <div className="nav-links">
        <a href="#" className="nav-link active">Dashboard</a>
        // <a href="#" className="nav-link">Predictions</a>
        // <a href="#" className="nav-link">Analytics</a>
        // <a href="#" className="nav-link">Settings</a>
      </div>
      <div className="nav-profile">
        <div className="profile-icon">👤</div>
      </div>
    </nav>
  );
};

export default Navbar;
