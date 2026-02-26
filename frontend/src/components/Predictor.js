import React, { useState, useRef } from "react";
import axios from "axios";
import { 
  FaSpinner, 
  FaChartLine, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaRedo,
  FaClock,
  FaServer
} from 'react-icons/fa';

export default function Predictor() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef(null);

  const predict = async (isRetry = false) => {
    if (!input.trim()) {
      setError({
        message: "Please enter a pain point",
        type: "validation"
      });
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    
    if (isRetry) {
      setRetryCount(prev => prev + 1);
    }

    try {
      // Fix: Send as query parameter, not in body
      const res = await axios.post(
        `https://predictive-model-backend.onrender.com/predict?pain_point=${encodeURIComponent(input)}`,
        null, // No body
        {
          headers: {
            'Accept': 'application/json',
          },
          timeout: 30000, // Increased to 30 seconds for cold start
          signal: abortControllerRef.current.signal
        }
      );
      
      if (res.data) {
        setResult(res.data);
        setRetryCount(0);
        setError(null);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      if (axios.isCancel(err)) {
        return;
      }

      console.error("Prediction error:", err);
      
      let errorMessage = "";
      let errorType = "unknown";

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond.";
        errorType = "timeout";
      } else if (!err.response) {
        if (err.message === 'Network Error') {
          errorMessage = "Cannot connect to the server. This usually happens when the Render.com free tier server is spinning up (takes 30-60 seconds). Please wait and try again.";
          errorType = "network";
        } else {
          errorMessage = err.message;
          errorType = "network";
        }
      } else if (err.response?.status === 422) {
        errorMessage = "Invalid request format. Please check your input.";
        errorType = "validation";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error occurred. The model might still be loading.";
        errorType = "server_error";
      } else {
        errorMessage = err.response?.data?.detail || 
                      err.response?.data?.message || 
                      err.message || 
                      "Failed to get prediction. Please try again.";
      }

      setError({
        message: errorMessage,
        type: errorType,
        details: err.response?.data || null
      });
      
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      predict();
    }
  };

  const handleRetry = () => {
    predict(true);
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      setError({
        message: "Request cancelled",
        type: "cancelled"
      });
    }
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <div className={`error-container ${error.type}`}>
        <div className="error-header">
          {error.type === 'timeout' && <FaClock className="error-icon" />}
          {error.type === 'network' && <FaServer className="error-icon" />}
          {error.type === 'validation' && <FaExclamationTriangle className="error-icon" />}
          {!['timeout', 'network', 'validation'].includes(error.type) && <FaExclamationTriangle className="error-icon" />}
          <span className="error-title">
            {error.type === 'timeout' && 'Request Timeout'}
            {error.type === 'network' && 'Network Error'}
            {error.type === 'validation' && 'Validation Error'}
            {error.type === 'server_error' && 'Server Error'}
            {!['timeout', 'network', 'validation', 'server_error'].includes(error.type) && 'Error'}
          </span>
        </div>
        
        <p className="error-message">{error.message}</p>
        
        {error.type === 'network' && (
          <div className="error-suggestions">
            <p className="suggestion-title">The Render.com free tier server might be sleeping. This is normal! Here's what's happening:</p>
            <ul className="suggestion-list">
              <li>• Free tier servers spin down after 15 minutes of inactivity</li>
              <li>• It takes 30-60 seconds to wake up on first request</li>
              <li>• Please wait a moment and try again</li>
              <li>• The server will respond faster after the first successful request</li>
            </ul>
          </div>
        )}

        {error.type === 'timeout' && (
          <div className="error-suggestions">
            <p className="suggestion-title">The server is taking longer than expected:</p>
            <ul className="suggestion-list">
              <li>• Click "Try Again" to retry the request</li>
              <li>• The model might be processing a complex input</li>
              <li>• Try with a shorter pain point description</li>
            </ul>
          </div>
        )}

        <div className="error-actions">
          <button 
            className="retry-button"
            onClick={handleRetry}
            disabled={loading}
          >
            <FaRedo className={loading ? 'spinner' : ''} />
            Try Again
          </button>
          {loading && (
            <button 
              className="cancel-button"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="predictor">
      <div className="predictor-header">
        <FaChartLine className="predictor-icon" />
        <h2>AI Lead Success Predictor</h2>
      </div>
      
      <div className="predictor-description">
        <p>Enter your lead's pain point to get AI-powered prediction of conversion success probability.</p>
        <div className="note">
          <strong>⚠️ Note:</strong> The server is on Render.com free tier. First request may take 30-60 seconds to wake up the server. Please be patient!
        </div>
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
          className={error?.type === 'validation' ? 'error' : ''}
        />
      </div>

      <div className="button-group">
        <button 
          className={`predict-button ${loading ? 'loading' : ''}`}
          onClick={() => predict()}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <>
              <FaSpinner className="spinner" />
              <span>Waking up server... (30-60s)</span>
            </>
          ) : (
            <span>Predict Success Rate</span>
          )}
        </button>
      </div>

      {loading && (
        <div className="loading-indicator">
          <div className="loading-progress">
            <div className="loading-bar"></div>
          </div>
          <p className="loading-text">Connecting to server... Please wait</p>
          <p className="loading-subtext">
            {retryCount > 0 ? `Retry attempt ${retryCount}...` : 'Free tier server waking up (30-60 seconds)'}
          </p>
        </div>
      )}

      {renderError()}

      {result && !error && (
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
                >
                  <span className="probability-value">
                    {((result.probability * 100) || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {retryCount > 0 && (
              <div className="retry-info">
                <FaRedo />
                <span>Connected after {retryCount} {retryCount === 1 ? 'retry' : 'retries'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
