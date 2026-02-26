import React,{useState} from "react"

import {Canvas} from "@react-three/fiber"

import {Float, OrbitControls} from "@react-three/drei"

import {motion} from "framer-motion"


export default function App(){

const[pain,setPain]=useState("")

const[result,setResult]=useState(null)


const predict=async()=>{

const res=await fetch(

"https://your-backend.onrender.com/predict",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

pain_point:pain

})

}

)

const data=await res.json()

setResult(data)

}


return(

<div style={{height:"100vh"}}>


<Canvas>

<OrbitControls/>

<Float>

mesh>

<boxGeometry/>

<meshStandardMaterial color="cyan"/>

</mesh>

</Float>

</Canvas>


<motion.div

initial={{opacity:0}}

animate={{opacity:1}}

>


<h1>

AI Lead Predictor

</h1>


<input

onChange={e=>setPain(e.target.value)}

/>


<button onClick={predict}>

Predict

</button>


{result && (

<div>

Prediction: {result.prediction}

Probability: {result.probability}

</div>

)}


</motion.div>


</div>

)

}
