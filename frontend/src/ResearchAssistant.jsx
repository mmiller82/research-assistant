import { useState } from 'react'
import { Client } from '@langchain/langgraph-sdk'
import ReactMarkdown from 'react-markdown'
import { firebaseConfig } from './firebase'
import './ResearchAssistant.css'


const ResearchAssistant = () => {
  const [topic, setTopic] = useState('')
  const [maxAnalysts, setMaxAnalysts] = useState(3)
  const [humanFeedback, setHumanFeedback] = useState('Yes')
  const [isRunning, setIsRunning] = useState(false)
  const [streamedData, setStreamedData] = useState([])
  const [currentStatus, setCurrentStatus] = useState('')
  const [threadId, setThreadId] = useState(null)
  const [finalReport, setFinalReport] = useState(null)
  const [isInterrupted, setIsInterrupted] = useState(false)
  const [createdAnalysts, setCreatedAnalysts] = useState(null)


  const createClient = () => {

    const client = new Client({
      apiUrl: window.location.origin,
      defaultHeaders: {
          "Content-Type": "application/json",
          "X-Api-Key": firebaseConfig.apiKey,
        }
      }
    )

    return client;
  }
    
  const client = createClient();

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!topic.trim()) {
      alert('Please enter a research topic')
      return
    }

    setIsRunning(true)
    setStreamedData([])
    setCurrentStatus('Initializing research...')
    setFinalReport(null)
    setIsInterrupted(false)
    setCreatedAnalysts(null)

    try {
      const input = {
        topic: topic,
        max_analysts: maxAnalysts,
        human_analyst_feedback: humanFeedback
      }

      // Create a thread
      const thread = await client.threads.create()
      setThreadId(thread.thread_id)

      // Stream the graph execution
      const streamResponse = client.runs.stream(
        thread.thread_id,
        'research_assistant',
        {
          input,
          streamMode: 'updates'
        }
      )

      // Process the stream
      for await (const chunk of streamResponse) {
        console.log('Stream chunk:', chunk)

        if (chunk.event === 'metadata') {
          setCurrentStatus(`Running...`)
        } else if (chunk.event === 'updates') {
          // Handle different node updates
          const data = chunk.data

          if (data) {
            const nodeNames = Object.keys(data)

            for (const nodeName of nodeNames) {
              const nodeData = data[nodeName]

              setStreamedData(prev => [...prev, {
                node: nodeName,
                data: nodeData,
                timestamp: new Date().toISOString()
              }])

              // Update status based on node
              console.log('Node update:', nodeName, nodeData);
              if (nodeName === 'create_analysts' && nodeData.analysts) {
                setCurrentStatus(`Created ${nodeData.analysts.length} analysts`)
                setCreatedAnalysts(nodeData.analysts)
              } else if (nodeName === '__interrupt__') {
                setCurrentStatus('Waiting on human feedback in regards to analysts...')
                setIsRunning(false)
                setIsInterrupted(true)
              } else if (nodeName === 'human_feedback') {
                setCurrentStatus('Processing human feedback on analysts...')
              } else if (nodeName === 'conduct_interview') {
                setCurrentStatus('Conducting interviews...')
              } else if (nodeName === 'write_report') {
                setCurrentStatus('Writing report...')
              } else if (nodeName === 'write_introduction') {
                setCurrentStatus('Writing introduction...')
              } else if (nodeName === 'write_conclusion') {
                setCurrentStatus('Writing conclusion...')
              } else if (nodeName === 'finalize_report') {
                setCurrentStatus('Finalizing report...')
                if (nodeData.final_report) {
                  setFinalReport(nodeData.final_report)
                }
              }
            }
          }
        } else if (chunk.event === 'end') {
          setCurrentStatus('Research completed!')
          setIsRunning(false)
        }
      }
    } catch (error) {
      console.error('Error running research:', error)
      setCurrentStatus(`Error: ${error.message}`)
      setIsRunning(false)
    }
  }

  const handleContinue = async () => {
    if (!threadId) return

    setIsRunning(true)
    setIsInterrupted(false)
    setCurrentStatus('Continuing research with updated feedback...')

    try {
      // Update the thread state with new human feedback
      await client.threads.updateState(
        threadId,
        {
          values: { human_analyst_feedback: humanFeedback }
        }
      )

      // Resume the run by streaming again
      const streamResponse = client.runs.stream(
        threadId,
        'research_assistant',
        {
          command: { resume: humanFeedback },
          streamMode: 'updates'
        }
      )

      // Process the stream
      for await (const chunk of streamResponse) {
        console.log('Stream chunk:', chunk)

        if (chunk.event === 'updates') {
          const data = chunk.data

          if (data) {
            const nodeNames = Object.keys(data)

            for (const nodeName of nodeNames) {
              const nodeData = data[nodeName]

              setStreamedData(prev => [...prev, {
                node: nodeName,
                data: nodeData,
                timestamp: new Date().toISOString()
              }])

            // Update status based on node
            if (nodeName === 'create_analysts' && nodeData.analysts) {
              setCurrentStatus(`Re-created ${nodeData.analysts.length} analysts`)
              setCreatedAnalysts(nodeData.analysts)
            } else if (nodeName === '__interrupt__') {
              setCurrentStatus('Waiting on human feedback in regards to analysts...')
              setIsInterrupted(true)
              setIsRunning(false)
            } else if (nodeName === 'human_feedback') {
              setCurrentStatus('Processing human feedback on analysts...')
            } else if (nodeName === 'conduct_interview') {
              setCurrentStatus('Conducting interviews...')
            } else if (nodeName === 'write_report') {
              setCurrentStatus('Writing report...')
            } else if (nodeName === 'write_introduction') {
              setCurrentStatus('Writing introduction...')
            } else if (nodeName === 'write_conclusion') {
              setCurrentStatus('Writing conclusion...')
            } else if (nodeName === 'finalize_report') {
              setCurrentStatus('Finalizing report...')
              if (nodeData.final_report) {
                setIsRunning(false)
                setFinalReport(nodeData.final_report)
                setCurrentStatus('Report finished.')
              }
            }
          }
          }
        } else if (chunk.event === 'end') {
          setCurrentStatus('Research completed!')
          setIsRunning(false)
          setIsInterrupted(false)
        }
      }
    } catch (error) {
      console.error('Error continuing research:', error)
      setCurrentStatus(`Error: ${error.message}`)
      setIsRunning(false)
      setIsInterrupted(false)
    }
  }

  const renderAnalysts = (analysts) => {
    return (
      <div className="analysts-list">
        <h3>Analysts Created:</h3>
        {analysts.map((analyst, idx) => (
          <div key={idx} className="analyst-card">
            <h4>{analyst.name}</h4>
            <p><strong>Role:</strong> {analyst.role}</p>
            <p><strong>Affiliation:</strong> {analyst.affiliation}</p>
            <p>{analyst.description}</p>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="research-assistant">
      <header className="header">
        <h2>Research Assistant</h2>
        <p>AI-powered reseach tool with multiple analysts</p>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit} className="input-form">
          <div className="form-group">
            <label htmlFor="topic">Research Topic:</label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The impact of AI on healthcare"
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxAnalysts">Number of Analysts:</label>
            <input
              id="maxAnalysts"
              type="number"
              value={maxAnalysts}
              onChange={(e) => setMaxAnalysts(parseInt(e.target.value))}
              min="1"
              max="5"
              disabled={isRunning}
            />
          </div>

          <div className="form-group">
            <label 
            htmlFor="feedback">
            Human Feedback:
            </label>
            <input
              id="feedback"
              type="text"
              value={humanFeedback}
              onChange={(e) => setHumanFeedback(e.target.value)}
              placeholder="type Yes (or provide feedback)"
              disabled={isRunning}
            />
          </div>

          <div className="button-container">
          <button type="submit" disabled={isRunning} className="btn-primary">
            {isRunning ? 'Running...' : 'Start Research'}
          </button>
          </div>
        </form>

        {currentStatus && (
          <div className="status">
            <strong>Status:</strong> {currentStatus}
          </div>
        )}

        {isInterrupted && createdAnalysts && (
          <div className="interrupt-panel">
            <h2>Review Analysts</h2>
            <p>The workflow is paused for your review. Please review the analysts below and provide feedback if needed, then click Continue to proceed.</p>

            {renderAnalysts(createdAnalysts)}

            <div className="form-group">
              <label htmlFor="continueFeedback">Update Feedback (or keep "Yes" to continue):</label>
              <textarea
                id="continueFeedback"
                value={humanFeedback}
                onChange={(e) => setHumanFeedback(e.target.value)}
                placeholder="Type 'Yes' to continue, or provide specific feedback to regenerate analysts"
                rows="3"
                disabled={isRunning}
              />
            </div>

            <button onClick={handleContinue} disabled={isRunning} className="btn-continue">
              {isRunning ? 'Continuing...' : 'Continue Research'}
            </button>
          </div>
        )}

        {streamedData.length > 0 && (
          <div className="stream-output">
            <h2>Research Progress</h2>
            {streamedData.map((item, idx) => (
              <div key={idx} className="stream-item">
                <div className="stream-item-header">
                  <strong>{item.node}</strong>
                  <span className="timestamp">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {item.node === 'create_analysts' && item.data.analysts && (
                  renderAnalysts(item.data.analysts)
                )}

                {item.node === 'conduct_interview' && item.data.sections && (
                  <div className="section-preview">
                    <ReactMarkdown>{item.data.sections[item.data.sections.length - 1]}</ReactMarkdown>
                  </div>
                )}

                {item.node === 'write_introduction' && item.data.introduction && (
                  <div className="introduction-preview">
                    <h3>Introduction:</h3>
                    <ReactMarkdown>{item.data.introduction}</ReactMarkdown>
                  </div>
                )}

                {item.node === 'write_conclusion' && item.data.conclusion && (
                  <div className="conclusion-preview">
                    <h3>Conclusion:</h3>
                    <ReactMarkdown>{item.data.conclusion}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {finalReport && (
          <div className="final-report">
            <h2>Final Report</h2>
            <div className="report-content">
              <ReactMarkdown>{finalReport}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResearchAssistant
