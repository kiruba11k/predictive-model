import React, { useState } from "react";
import axios from "axios";
import { FaSpinner, FaChartLine, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

export default function Predictor() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const predict = async () => {
    if (!input.trim()) {
      setError("Please enter a pain point");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await axios.post(
        "https://predictive-model-backend.onrender.com/predict",
        { pain_point: input },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000 // 10 second timeout
        }
      );
      
      if (res.data) {
        setResult(res.data);
      } else {
        setError("Invalid response from server");
      }
    } catch (err) {
      console.error("Prediction error:", err);
      setError(
        err.response?.data?.message || 
        err.message || 
        "Failed to get prediction. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      predict();
    }
  };

  return (
    <div className="predictor">
      <div className="predictor-header">
        <FaChartLine className="predictor-icon" />
        <h2>AI Lead Success Predictor</h2>
      </div>
      
      <div className="predictor-description">
        <p>Enter your lead's pain point to get AI-powered prediction of conversion success probability.</p>
      </div>

      <div className="input-group">
        <label htmlFor="painPoint">Pain Point Description</label>
        <input
          id="painPoint"
          type="text"
          placeholder="e.g., Need better customer engagement, High operational costs..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          className={error ? 'error' : ''}
        />
        {error && (
          <div className="error-message">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}
      </div>

      <button 
        className={`predict-button ${loading ? 'loading' : ''}`}
        onClick={predict}
        disabled={loading || !input.trim()}
      >
        {loading ? (
          <>
            <FaSpinner className="spinner" />
            <span>Analyzing...</span>
          </>
        ) : (
          <span>Predict Success Rate</span>
        )}
      </button>

      {result && (
        <div className="result-card">
          <div className="result-header">
            <FaCheckCircle className="result-icon" />
            <h3>Prediction Result</h3>
          </div>
          
          <div className="result-content">
            <div className="prediction-badge">
              <span className="prediction-label">Prediction:</span>
              <span className={`prediction-value ${result.prediction?.toLowerCase()}`}>
                {result.prediction || "N/A"}
              </span>
            </div>
            
            <div className="probability-container">
              <span className="probability-label">Success Probability:</span>
              <div className="probability-bar-container">
                <div 
                  className="probability-bar"
                  style={{ 
                    width: `${(result.probability * 100) || 0}%`,
                    background: `linear-gradient(90deg, #00ffff, #ff00ff)`
                  }}
                />
                <span className="probability-value">
                  {((result.probability * 100) || 0).toFixed(2)}%
                </span>
              </div>
            </div>

            {result.confidence && (
              <div className="confidence-score">
                <span>Confidence Score:</span>
                <span>{result.confidence}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
