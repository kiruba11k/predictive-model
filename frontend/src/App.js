import React,{useState} from "react"

import axios from "axios"

import {Canvas} from "@react-three/fiber"

import {Float, OrbitControls} from "@react-three/drei"

import {motion} from "framer-motion"

import "./App.css"



function Cube(){

return(

<Float speed={3}>

mesh>

boxGeometry args={[2,2,2]}/>

meshStandardMaterial

color="#00ffff"

metalness={1}

roughness={0}

/>

</mesh>

</Float>

)

}



export default function App(){


const[pain,setPain]=useState("")

const[result,setResult]=useState(null)

const[loading,setLoading]=useState(false)



const predict=async()=>{

setLoading(true)

const res=await axios.post(

"https://predictive-model-backend.onrender.com/predict",

{

pain_point:pain

}

)

setResult(res.data)

setLoading(false)

}



return(


<div className="container">


<Canvas className="bg">

ambientLight intensity={1}/>

pointLight position={[10,10,10]}/>

<Cube/>

<OrbitControls enableZoom={false}/>

</Canvas>



<motion.div

className="card"

initial={{opacity:0,y:50}}

animate={{opacity:1,y:0}}

transition={{duration:1}}

>


<h1>

AI Predictive Engine

</h1>



<input

placeholder="Enter company pain point..."

onChange={(e)=>setPain(e.target.value)}

/>



<button onClick={predict}>

Predict

</button>



{loading && (

<p>Analyzing...</p>

)}



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

)

}
