import React from "react";

export default function Navbar({ toggleSidebar }) {

return (

<header className="navbar">

<button className="hamburger" onClick={toggleSidebar}>

☰

</button>

<h1>AI Predictive Platform</h1>

</header>

);

}
