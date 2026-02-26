import React from 'react';
import { 
  FaChartBar, 
  FaRobot, 
  FaChartLine, 
  FaCog, 
  FaFolder, 
  FaUsers,
  FaHome,
  FaDatabase,
  FaBell,
  FaUserCircle
} from 'react-icons/fa';

const Sidebar = ({ open, setOpen }) => {
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'active' : ''}`} onClick={() => setOpen(false)} />
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>Navigation</h3>
          <button className="close-sidebar" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="sidebar-links">
          <a href="#" className="sidebar-link active">
            <FaChartBar className="sidebar-icon" />
            <span>Dashboard</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaRobot className="sidebar-icon" />
            <span>AI Predictor</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaChartLine className="sidebar-icon" />
            <span>Analytics</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaDatabase className="sidebar-icon" />
            <span>Data Models</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaFolder className="sidebar-icon" />
            <span>Projects</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaUsers className="sidebar-icon" />
            <span>Team</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaBell className="sidebar-icon" />
            <span>Notifications</span>
          </a>
          <a href="#" className="sidebar-link">
            <FaCog className="sidebar-icon" />
            <span>Settings</span>
          </a>
        </div>
        <div className="sidebar-footer">
          <a href="#" className="sidebar-link">
            <FaUserCircle className="sidebar-icon" />
            <span>Profile</span>
          </a>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
