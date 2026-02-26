import React, { useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Predictor from "./components/Predictor";
import Dashboard from "./components/Dashboard";

import "./App.css";

export default function App() {

const [sidebarOpen, setSidebarOpen] = useState(false);

return (

<div className="app">

<Navbar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

<Sidebar open={sidebarOpen} />

<main className="main">

<Dashboard />

<Predictor />

</main>

</div>

);

}
