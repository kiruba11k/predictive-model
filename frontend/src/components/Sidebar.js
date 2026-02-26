import React from "react";

export default function Sidebar({ open }) {

return (

<aside className={`sidebar ${open ? "open" : ""}`}>

<h2>Dashboard</h2>

<nav>

<a href="#">Predict</a>

<a href="#">Analytics</a>

<a href="#">Reports</a>

<a href="#">Settings</a>

</nav>

</aside>

);

}
