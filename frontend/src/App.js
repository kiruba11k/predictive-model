import React, { useState } from "react";
import axios from "axios";

import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, Stars } from "@react-three/drei";

import { motion } from "framer-motion";

import "./App.css";


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

  );

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

        { pain_point: pain }

      );

      setResult(res.data);

    }

    catch {

      alert("API Error");

    }

    setLoading(false);

  };


  return (

    <div className="layout">


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

        <button className="menuBtn">Predict</button>

        <button className="menuBtn">Analytics</button>

        <button className="menuBtn">Settings</button>

      </div>



      {/* MAIN CONTENT */}


      <div className="content">


        <motion.div

          className="card"

          initial={{opacity:0,y:50}}

          animate={{opacity:1,y:0}}

        >


          <h1>

            AI Lead Predictor

          </h1>



          <input

            value={pain}

            onChange={(e)=>setPain(e.target.value)}

            placeholder="Enter company pain point"

          />



          <button onClick={predict}>

            {loading ? "Analyzing..." : "Predict"}

          </button>



          {result && (

            <div className="result">


              <h2>

                {result.prediction}

              </h2>


              <p>

                Probability:

                {(result.probability*100).toFixed(2)}%

              </p>


            </div>

          )}


        </motion.div>


      </div>


    </div>

  );

}
