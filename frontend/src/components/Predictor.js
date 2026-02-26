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
      setError("Please enter a pain point");
      return;
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);
    
    if (isRetry) {
      setRetryCount(prev => prev + 1);
    }

    try {
      const res = await axios.post(
        "https://predictive-model-backend.onrender.com/predict",
        { pain_point: input },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000, // Increased to 15 seconds
          signal: abortControllerRef.current.signal
        }
      );
      
      if (res.data) {
        setResult(res.data);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      // Handle different types of errors
      if (axios.isCancel(err)) {
        console.log('Request canceled:', err.message);
        return;
      }

      console.error("Prediction error:", err);
      
      let errorMessage = "";
      let errorType = "unknown";

      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = "Request timed out. The server is taking too long to respond.";
        errorType = "timeout";
      } else if (!err.response && err.message === 'Network Error') {
        errorMessage = "Cannot connect to the server. Please check your internet connection.";
        errorType = "network";
      } else if (err.response?.status === 429) {
        errorMessage = "Too many requests. Please wait a moment and try again.";
        errorType = "rate_limit";
      } else if (err.response?.status === 503 || err.response?.status === 504) {
        errorMessage = "Server is temporarily unavailable. Please try again later.";
        errorType = "server_unavailable";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error occurred. Our team has been notified.";
        errorType = "server_error";
      } else {
        errorMessage = err.response?.data?.message || 
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
      abortControllerRef.current = null;
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

  // Render error message based on type
  const renderError = () => {
    if (!error) return null;

    const errorIcons = {
      timeout: <FaClock className="error-icon" />,
      network: <FaServer className="error-icon" />,
      rate_limit: <FaExclamationTriangle className="error-icon" />,
      server_error: <FaExclamationTriangle className="error-icon" />,
      server_unavailable: <FaServer className="error-icon" />,
      cancelled: <FaExclamationTriangle className="error-icon" />,
      default: <FaExclamationTriangle className="error-icon" />
    };

    const errorMessages = {
      timeout: {
        title: "Request Timeout",
        suggestion: "The server might be busy. You can try:"
      },
      network: {
        title: "Network Error",
        suggestion: "Please check:"
      },
      rate_limit: {
        title: "Rate Limit Exceeded",
        suggestion: "Suggestions:"
      },
      server_error: {
        title: "Server Error",
        suggestion: "What you can do:"
      },
      server_unavailable: {
        title: "Server Unavailable",
        suggestion: "The server might be:"
      },
      default: {
        title: "Error",
        suggestion: "Suggestions:"
      }
    };

    const currentError = errorMessages[error.type] || errorMessages.default;

    return (
      <div className={`error-container ${error.type}`}>
        <div className="error-header">
          {errorIcons[error.type] || errorIcons.default}
          <span className="error-title">{currentError.title}</span>
        </div>
        
        <p className="error-message">{error.message}</p>
        
        <div className="error-suggestions">
          <p className="suggestion-title">{currentError.suggestion}</p>
          <ul className="suggestion-list">
            {error.type === 'timeout' && (
              <>
                <li>• Wait a few seconds and try again</li>
                <li>• Check if the input is too complex</li>
                <li>• Try with a shorter pain point description</li>
              </>
            )}
            {error.type === 'network' && (
              <>
                <li>• Your internet connection</li>
                <li>• If the server is online (render.com free tier might be sleeping)</li>
                <li>• Firewall or proxy settings</li>
              </>
            )}
            {error.type === 'rate_limit' && (
              <>
                <li>• Wait 30-60 seconds before trying again</li>
                <li>• Reduce the frequency of requests</li>
                <li>• Try again with a different input</li>
              </>
            )}
            {(error.type === 'server_error' || error.type === 'server_unavailable') && (
              <>
                <li>• Wait a few minutes and try again</li>
                <li>• Check if the server is under maintenance</li>
                <li>• Try again later</li>
              </>
            )}
            {!error.type && (
              <>
                <li>• Check your input and try again</li>
                <li>• Try with a different pain point</li>
                <li>• Refresh the page and try again</li>
              </>
            )}
          </ul>
        </div>

        <div className="error-actions">
          <button 
            className="retry-button"
            onClick={handleRetry}
            disabled={loading}
          >
            <FaRedo className={loading ? 'spinner' : ''} />
            Try Again
          </button>
          {error.type === 'timeout' && (
            <button 
              className="cancel-button"
              onClick={handleCancel}
            >
              Cancel Request
            </button>
          )}
        </div>

        {error.details && (
          <details className="error-details">
            <summary>Technical Details</summary>
            <pre>{JSON.stringify(error.details, null, 2)}</pre>
          </details>
        )}
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
        <p className="note">Note: The server might take 10-15 seconds to respond if it's starting up (free tier on render.com)</p>
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
              <span>Analyzing... (this may take up to 15s)</span>
            </>
          ) : (
            <span>Predict Success Rate</span>
          )}
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

      {loading && (
        <div className="loading-indicator">
          <div className="loading-progress">
            <div className="loading-bar"></div>
          </div>
          <p className="loading-text">Connecting to server... Please wait</p>
          <p className="loading-subtext">Free tier servers may take 10-15 seconds to wake up</p>
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

            {result.confidence && (
              <div className="confidence-score">
                <span>Confidence Score:</span>
                <span className="confidence-value">{result.confidence}</span>
              </div>
            )}

            {retryCount > 0 && (
              <div className="retry-info">
                <FaRedo />
                <span>Successfully connected after {retryCount} {retryCount === 1 ? 'retry' : 'retries'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
