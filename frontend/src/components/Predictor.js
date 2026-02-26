import React, { useState } from "react";
import axios from "axios";

export default function Predictor() {

const [input, setInput] = useState("");

const [result, setResult] = useState(null);

const [loading, setLoading] = useState(false);


const predict = async () => {

setLoading(true);

const res = await axios.post(

"https://predictive-model-backend.onrender.com/predict",

{ pain_point: input }

);

setResult(res.data);

setLoading(false);

};


return (

<div className="predictor">


<h2>Predict Lead Success</h2>


<input

placeholder="Enter pain point"

onChange={(e) => setInput(e.target.value)}

/>


<button onClick={predict}>

{loading ? "Analyzing..." : "Predict"}

</button>


{result && (

<div className="result">

<h3>{result.prediction}</h3>

<p>

Probability:

{(result.probability * 100).toFixed(2)}%

</p>

</div>

)}


</div>

);

}
