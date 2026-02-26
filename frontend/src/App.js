import React, { useState } from "react";
import axios from "axios";

import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, Stars } from "@react-three/drei";

import { motion } from "framer-motion";

import "./App.css";


// 3D Floating Sphere

function Sphere() {

return (

<Float speed={2}>

<mesh>

<sphereGeometry args={[1.5, 64, 64]} />

<meshStandardMaterial

color="#00ffff"

metalness={1}

roughness={0}

/>

</mesh>

</Float>

)

}


// Card animation

const cardAnim = {

hidden: { opacity: 0, y: 50 },

show: { opacity: 1, y: 0 }

}



export default function App() {


const [pain, setPain] = useState("");

const [result, setResult] = useState(null);

const [loading, setLoading] = useState(false);



const predict = async () => {

setLoading(true);

try {

const res = await axios.post(

"https://predictive-model-backend.onrender.com/predict",

{

pain_point: pain

}

);

setResult(res.data);

}

catch {

alert("Backend error");

}

setLoading(false);

};



return (


<div className="main">



{/* 3D BACKGROUND */}



<Canvas className="canvas">


<ambientLight intensity={1} />

<pointLight position={[10,10,10]} />


<Sphere />


<Stars />


<OrbitControls enableZoom={false} />


</Canvas>



{/* SIDEBAR */}



<div className="sidebar">


<h2>AI Dashboard</h2>


<button>

Predict

</button>


<button>

Analytics

</button>


<button>

Settings

</button>


</div>



{/* MAIN CARD */}



<motion.div

className="card"

variants={cardAnim}

initial="hidden"

animate="show"

transition={{ duration: 1 }}

>


<h1>

AI Lead Success Predictor

</h1>



<input

value={pain}

onChange={(e)=>setPain(e.target.value)}

placeholder="Enter company pain point"

/>



<button

onClick={predict}

>


{loading ? "Analyzing..." : "Predict"}


</button>



{result && (

<div className="result">


<h2>

{result.prediction}

</h2>


<p>

Probability:

{(result.probability * 100).toFixed(2)}%

</p>


</div>

)}


</motion.div>


</div>

);
}
