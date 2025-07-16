import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

//Ngrok URL
const BACKEND_URL = 'https://2aa35a52bbd0.ngrok-free.app/'; // Update this if ngrok restarts
//const BACKEND_URL ='http://127.0.0.1:5000';

function App() {
  const [text, setText] = useState('');
  const [chunks, setChunks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState({
    chunkNumbers: [],
    cumulativeKeywords: [],
    kdr: [],
    randomValues: [],
    entityDiscovery: [],
    convergenceChunk: null
  });

  // Reset backend state on first load
  useEffect(() => {
    const resetBackend = async () => {
      try {
        await fetch(`${BACKEND_URL}/reset`, { method: 'POST' });
        console.log("Backend state reset on load");
      } catch (err) {
        console.error("Backend reset failed on load:", err);
      }
    };
    resetBackend();
  }, []);

  const chunkTextByWords = (text, chunkSize = 600) => {
    const words = text.trim().split(/\s+/);
    const out = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      out.push(words.slice(i, i + chunkSize).join(' '));
    }
    return out;
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/reset`, { method: 'POST' });
      const json = await res.json();
      if (json.status !== "reset") {
        console.warn("Unexpected reset response:", json);
        return;
      }
      console.log("Backend state reset");

      const generatedChunks = chunkTextByWords(text);
      setChunks(generatedChunks);
      setCurrentIndex(0);
      setResults({
        chunkNumbers: [],
        cumulativeKeywords: [],
        kdr: [],
        randomValues: [],
        entityDiscovery: [],
        convergenceChunk: null
      });
    } catch (err) {
      console.error(" Failed to reset backend:", err);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/reset`, { method: 'POST' });
      const json = await res.json();
      if (json.status === "reset") {
        console.log("Reset successful");

        setText('');
        setChunks([]);
        setCurrentIndex(0);
        setResults({
          chunkNumbers: [],
          cumulativeKeywords: [],
          kdr: [],
          randomValues: [],
          entityDiscovery: [],
          convergenceChunk: null
        });
      }
    } catch (err) {
      console.error(" Error resetting:", err);
    }
  };

  useEffect(() => {
    if (currentIndex < chunks.length) {
      const chunk = chunks[currentIndex];
      if (!chunk.trim()) return;

      const sendChunk = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunk })
          });

          const data = await response.json();
          console.log(` Chunk ${data.chunk} sent | Words: ${chunk.split(/\s+/).length}`);

          setResults((prev) => ({
            chunkNumbers: [...prev.chunkNumbers, data.chunk],
            cumulativeKeywords: [...prev.cumulativeKeywords, data.cumulative_keywords],
            kdr: [...prev.kdr, data.kdr],
            randomValues: [...prev.randomValues, data.random_value],
            entityDiscovery: [...prev.entityDiscovery, data.entity_relation_discovery],
            convergenceChunk: data.convergence_chunk ?? prev.convergenceChunk
          }));

          setCurrentIndex((prev) => prev + 1);
        } catch (err) {
          console.error(" Chunk failed to send:", err);
        }
      };

      sendChunk();
    }
  }, [chunks, currentIndex]);

  return (
    <div style={{ display: 'flex', padding: 20 }}>
      {/* LEFT: Input */}
      <div style={{ flex: 1, paddingRight: 20 }}>
        <h1>Speech Completion Estimation</h1>
        <textarea
          rows="10"
          cols="60"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your text here"
        />
        <br />
        <button onClick={handleSubmit}>Analyze</button>
        <button onClick={handleReset} style={{ marginLeft: '10px' }}>Reset</button>

        {results.chunkNumbers.length > 0 && (
          <>
            <p><strong>Convergence occurs at chunk:</strong> {results.convergenceChunk ?? 'Not yet'}</p>
            <h3>Chunk-wise Estimated Percentage Completions</h3>
            <ul>
              {results.randomValues.map((val, i) => (
                <li key={i}>Chunk {i + 1}: {val}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* RIGHT: Charts */}
      <div style={{ flex: 2 }}>
        {results.chunkNumbers.length > 0 && (
          <>
            <D3Chart
              title="Cumulative Unique Keywords"
              x={results.chunkNumbers}
              y={results.cumulativeKeywords}
              xLabel="Chunk"
              yLabel="Cumulative Unique Keywords"
            />
            <D3Chart
              title="Keyword Discovery Rate (KDR)"
              x={results.chunkNumbers}
              y={results.kdr}
              xLabel="Chunk"
              yLabel="KDR"
              threshold={0.02}
              convergence={results.convergenceChunk}
            />
            <D3Chart
              title="Entity-Relation Discovery"
              x={results.chunkNumbers}
              y={results.entityDiscovery}
              xLabel="Chunk"
              yLabel="Entity-Relation Count"
            />
          </>
        )}
      </div>
    </div>
  );
}

function D3Chart({ title, x, y, xLabel, yLabel, threshold, convergence }) {
  const ref = useRef();

  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const width = 600;
    const height = 300;
    const margin = { top: 20, right: 40, bottom: 40, left: 60 };

    const xScale = d3.scaleLinear()
      .domain([d3.min(x), d3.max(x)])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(y) * 1.1 || 1])
      .range([height - margin.bottom, margin.top]);

    svg.append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat(d3.format("d")));

    svg.append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale).ticks(6));

    const line = d3.line()
      .x((_, i) => xScale(x[i]))
      .y((_, i) => yScale(y[i]))
      .curve(d3.curveMonotoneX);

    svg.append("path")
      .datum(y)
      .attr("fill", "none")
      .attr("stroke", "#0077cc")
      .attr("stroke-width", 2)
      .attr("d", line);

    svg.selectAll("circle")
      .data(y)
      .enter()
      .append("circle")
      .attr("cx", (_, i) => xScale(x[i]))
      .attr("cy", (_, i) => yScale(y[i]))
      .attr("r", 4)
      .attr("fill", "blue");

    if (threshold !== undefined) {
      svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", yScale(threshold))
        .attr("y2", yScale(threshold))
        .attr("stroke", "red")
        .attr("stroke-dasharray", "5,5");
    }

    if (convergence !== undefined && convergence !== null) {
      svg.append("line")
        .attr("x1", xScale(convergence))
        .attr("x2", xScale(convergence))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "green")
        .attr("stroke-dasharray", "5,5");
    }

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(xLabel);

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .text(yLabel);

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(title);
  }, [x, y, xLabel, yLabel, title, threshold, convergence]);

  return <svg ref={ref} width={600} height={300} />;
}

export default App;
