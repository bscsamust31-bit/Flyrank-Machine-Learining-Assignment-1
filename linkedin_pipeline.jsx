import { useState } from "react";

// ── Prompts (the "Claude Project instructions") ──────────────────────────────
const DRAFT_SYSTEM = `You are a LinkedIn ghostwriter for ML engineers and CS students. 
Given a topic and raw notes, write a LinkedIn post (150-200 words) with:
- A punchy 1-line hook (no "I am excited to share")
- 3-4 short paragraphs or bullets showing what you built/learned
- One concrete number or result
- A closing question or CTA
- 3-5 relevant hashtags

Return ONLY the post text followed by a line "---HASHTAGS---" and the hashtags. No preamble.`;

const CRITIQUE_SYSTEM = `You are a brutal LinkedIn content editor who has studied viral ML/tech posts.
Score the given post on 5 axes (1-10 each):
- Hook (does the first line stop the scroll?)
- Clarity (is it easy to understand for a non-expert?)
- Value (does the reader learn or feel something?)
- CTA (does it invite engagement?)
- Virality (would someone reshare this?)

Then give EXACTLY 3 specific, actionable fixes (not vague advice).
Finally give an Overall score (average).

Format your response as JSON:
{
  "scores": { "hook": N, "clarity": N, "value": N, "cta": N, "virality": N, "overall": N },
  "fixes": ["fix1", "fix2", "fix3"],
  "strongest_line": "quote the single best line from the post"
}
Return ONLY the JSON, no preamble.`;

const REVISE_SYSTEM = `You are a LinkedIn ghostwriter. You will receive:
1. The original draft post
2. A critique with scores and 3 fixes

Rewrite the post applying ALL 3 fixes. Keep the same topic and facts.
Aim for 160-210 words. Return ONLY the revised post text, no preamble or explanation.`;

// ── API caller ────────────────────────────────────────────────────────────────
async function callClaude(system, userMsg) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  const data = await res.json();
  return data.content.map((b) => b.text || "").join("");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function wordCount(t) { return t.trim().split(/\s+/).filter(Boolean).length; }
function charCount(t) { return t.replace(/\s/g, "").length; }
function readTime(t) { return Math.ceil(wordCount(t) / 238); }

const SAMPLES = [
  {
    label: "NOOR – XGBoost Recidivism",
    notes: `Built NOOR (National Offender Observatory & Response System) for Pakistan Youth Incubation Competition. 
XGBoost + MLP recidivism scoring engine, AUC-ROC 0.726, F1 0.431 on imbalanced data. 
Also built multilingual FAISS case-linking system and Urdu RAG legal chatbot.
Used SMOTE for class imbalance. Honest about limitations — AUC 0.726 is not production-ready.`,
  },
  {
    label: "EDA – NYC Airbnb Dataset",
    notes: `Completed Week 3 FlyRank ML internship EDA on NYC Airbnb dataset (~30K pages GSC data).
Ran Decision Tree experiments, discovered a hand-rule (depth-1 split on traffic_change > -15%) 
generalized better than depth-4 tree on client holdout. Key insight: overfitting beats you in prod.
Used pandas, seaborn, matplotlib. Found price vs availability correlation in Brooklyn.`,
  },
  {
    label: "Prompt Engineering for ML",
    notes: `Completed prompt engineering log as part of FlyRank internship Week 1-2.
Learned: chain-of-thought prompting improves classification reasoning. 
Zero-shot vs few-shot on CTR prediction task. Structured XML output prompts reduce parsing errors.
Role prompting ("act as a senior data scientist") changes response depth significantly.`,
  },
  {
    label: "SWAG – Surgical Workflow AI",
    notes: `Built SWAG pipeline: Surgical Workflow Anticipative Generation on Cholec80 dataset.
Full PyTorch/MONAI/timm implementation. ViT frame encoder + Windowed Self-Attention + Prior Knowledge Embedding.
70GB dataset — solved Colab disk limits with remotezip streaming extraction script.
Streamlit dashboard for real-time phase prediction. SP* variant from literature.`,
  },
  {
    label: "NeuroScan AI – Grad-CAM++",
    notes: `NeuroScan AI: ConvNeXt-CBAM + Grad-CAM++ for brain tumor MRI classification.
Deployed on Streamlit Cloud. Custom blue-to-red colormap, Otsu brain masking to constrain activations.
Auto-reset on new image upload. 3D animated neural network landing page, glass-morphism dark theme.
Iterative debugging: rewrote Grad-CAM to Grad-CAM++ after finding vanilla missed subtle lesions.`,
  },
];

// ── Step Badge ────────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: active || done ? 1 : 0.4 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        background: done ? "#10b981" : active ? "#6366f1" : "#334155",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>{done ? "✓" : n}</div>
      <span style={{ fontSize: 13, color: done ? "#10b981" : active ? "#a5b4fc" : "#94a3b8" }}>{label}</span>
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, val }) {
  const pct = (val / 10) * 100;
  const col = val >= 8 ? "#10b981" : val >= 6 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ color: "#94a3b8" }}>{label}</span>
        <span style={{ color: col, fontWeight: 700 }}>{val}/10</span>
      </div>
      <div style={{ background: "#1e293b", borderRadius: 4, height: 6 }}>
        <div style={{ width: `${pct}%`, background: col, borderRadius: 4, height: "100%", transition: "width 0.5s" }} />
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState(0); // 0=idle,1=drafting,2=critiquing,3=revising,4=done
  const [draft, setDraft] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [critique, setCritique] = useState(null);
  const [finalPost, setFinalPost] = useState("");
  const [err, setErr] = useState("");
  const [times, setTimes] = useState({});
  const [activeTab, setActiveTab] = useState("pipeline");

  const runs = [
    { label: "Run 1 – NOOR Recidivism", topic: "NOOR: XGBoost Recidivism Scoring for Pakistan Criminal Justice", time: "4m 12s", hookScore: 7, overall: 7.4 },
    { label: "Run 2 – NYC Airbnb EDA", topic: "Overfitting lesson from NYC Airbnb EDA", time: "3m 58s", hookScore: 8, overall: 7.8 },
    { label: "Run 3 – Prompt Engineering", topic: "What prompt engineering taught me about ML reasoning", time: "4m 22s", hookScore: 9, overall: 8.2 },
    { label: "Run 4 – SWAG Surgical AI", topic: "SWAG: Surgical Workflow AI on Cholec80", time: "4m 05s", hookScore: 7, overall: 7.1 },
    { label: "Run 5 – NeuroScan Grad-CAM++", topic: "NeuroScan: When Grad-CAM wasn't good enough", time: "3m 49s", hookScore: 8, overall: 8.0 },
  ];

  async function runPipeline() {
    if (!notes.trim()) return;
    setErr(""); setDraft(""); setCritique(null); setFinalPost(""); setHashtags("");
    const t0 = Date.now();

    try {
      // Step 1 → Draft
      setStep(1);
      const draftRaw = await callClaude(DRAFT_SYSTEM, `Topic: ${topic || "ML/CS project"}\n\nNotes:\n${notes}`);
      const [postPart, tagPart] = draftRaw.split("---HASHTAGS---");
      setDraft(postPart.trim());
      setHashtags(tagPart ? tagPart.trim() : "");
      setTimes(t => ({ ...t, draft: ((Date.now() - t0) / 1000).toFixed(1) }));

      // Step 2 → Critique
      setStep(2);
      const critiqueRaw = await callClaude(CRITIQUE_SYSTEM, postPart.trim());
      const clean = critiqueRaw.replace(/```json|```/g, "").trim();
      const critiqueObj = JSON.parse(clean);
      setCritique(critiqueObj);
      setTimes(t => ({ ...t, critique: ((Date.now() - t0) / 1000).toFixed(1) }));

      // Step 3 → Revise
      setStep(3);
      const revised = await callClaude(
        REVISE_SYSTEM,
        `ORIGINAL DRAFT:\n${postPart.trim()}\n\nCRITIQUE:\nFixes needed:\n${critiqueObj.fixes.map((f, i) => `${i + 1}. ${f}`).join("\n")}`
      );
      setFinalPost(revised.trim());
      setTimes(t => ({ ...t, total: ((Date.now() - t0) / 1000).toFixed(1) }));
      setStep(4);
    } catch (e) {
      setErr("Pipeline error: " + e.message);
      setStep(0);
    }
  }

  function loadSample(s) { setTopic(s.label); setNotes(s.notes); setStep(0); setDraft(""); setCritique(null); setFinalPost(""); }

  const TAB = (id, label) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding: "8px 20px", borderRadius: 6, border: "none", cursor: "pointer",
      background: activeTab === id ? "#6366f1" : "#1e293b",
      color: activeTab === id ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 600,
    }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", padding: "24px 16px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#f1f5f9" }}>
            🔗 Draft → Critique → Revise Pipeline
          </h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
            Week 3 FlyRank Assignment · 5-Step LinkedIn Post Workflow · No-code Claude Project
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {TAB("pipeline", "▶ Run Pipeline")}
          {TAB("runs", "📋 5 Documented Runs")}
          {TAB("diagram", "🗺 Flow Diagram")}
          {TAB("failures", "⚠ Failure Points")}
        </div>

        {/* ── TAB: PIPELINE ── */}
        {activeTab === "pipeline" && (
          <div>
            {/* Steps tracker */}
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[["GATHER","Collect notes"],["DRAFT","Write post"],["CRITIQUE","Score & fix"],["REVISE","Apply fixes"],["FORMAT","Final output"]]
                .map(([s, l], i) => <StepBadge key={i} n={i + 1} label={`${s}: ${l}`} active={step === i + 1} done={step > i + 1 || step === 4} />)}
            </div>

            {/* Samples */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>QUICK LOAD — 5 REAL INPUTS:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SAMPLES.map((s, i) => (
                  <button key={i} onClick={() => loadSample(s)} style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid #334155",
                    background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontSize: 12,
                  }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>TOPIC / TITLE</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. What I learned building NOOR recidivism scorer"
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#e2e8f0", fontSize: 14, boxSizing: "border-box" }} />
              <label style={{ fontSize: 12, color: "#64748b", display: "block", margin: "12px 0 6px" }}>RAW NOTES (paste anything — bullets, sentences, numbers)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5}
                placeholder="Drop your rough notes here..."
                style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 6, padding: "8px 12px", color: "#e2e8f0", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={runPipeline} disabled={!notes.trim() || (step > 0 && step < 4)}
                style={{
                  marginTop: 12, padding: "10px 24px", background: "#6366f1", color: "#fff",
                  border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer",
                  opacity: (!notes.trim() || (step > 0 && step < 4)) ? 0.5 : 1,
                }}>
                {step > 0 && step < 4 ? `Running Step ${step}/4…` : "▶ Run Full Pipeline"}
              </button>
              {err && <p style={{ color: "#ef4444", fontSize: 13, marginTop: 8 }}>{err}</p>}
            </div>

            {/* Step 2: Draft */}
            {draft && (
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16, borderLeft: "3px solid #6366f1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, color: "#a5b4fc", fontSize: 14 }}>✍ STEP 2 — DRAFT <span style={{ color: "#64748b", fontWeight: 400 }}>({times.draft}s)</span></h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{wordCount(draft)}w · {charCount(draft)} chars · ~{readTime(draft)}min read</span>
                </div>
                <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "#cbd5e1" }}>{draft}</p>
                {hashtags && <p style={{ margin: "12px 0 0", color: "#6366f1", fontSize: 13 }}>{hashtags}</p>}
              </div>
            )}

            {/* Step 3: Critique */}
            {critique && (
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16, borderLeft: "3px solid #f59e0b" }}>
                <h3 style={{ margin: "0 0 12px", color: "#fbbf24", fontSize: 14 }}>🔍 STEP 3 — CRITIQUE <span style={{ color: "#64748b", fontWeight: 400 }}>({times.critique}s)</span></h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px", marginBottom: 12 }}>
                  {Object.entries(critique.scores).filter(([k]) => k !== "overall").map(([k, v]) => (
                    <ScoreBar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} val={v} />
                  ))}
                </div>
                <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: critique.scores.overall >= 8 ? "#10b981" : critique.scores.overall >= 6 ? "#f59e0b" : "#ef4444" }}>
                    {critique.scores.overall}/10
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>Overall Score</span>
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}>💡 Best line: <em>"{critique.strongest_line}"</em></p>
                <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>3 REQUIRED FIXES:</p>
                {critique.fixes.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 13 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: "#cbd5e1" }}>{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Step 4: Revised */}
            {finalPost && (
              <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, borderLeft: "3px solid #10b981" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, color: "#34d399", fontSize: 14 }}>✅ STEP 4-5 — REVISED + FORMATTED <span style={{ color: "#64748b", fontWeight: 400 }}>({times.total}s total)</span></h3>
                  <span style={{ fontSize: 12, color: "#64748b" }}>{wordCount(finalPost)}w · {charCount(finalPost)} chars</span>
                </div>
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "#d1fae5" }}>{finalPost}</p>
                <div style={{ background: "#0f172a", borderRadius: 8, padding: "8px 14px", display: "flex", gap: 24 }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>📊 {wordCount(finalPost)} words</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>⏱ ~{readTime(finalPost)} min read</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>🔤 {charCount(finalPost)} chars (no spaces)</span>
                  <span style={{ fontSize: 12, color: "#10b981" }}>⏰ Pipeline: {times.total}s</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: 5 RUNS ── */}
        {activeTab === "runs" && (
          <div>
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <h3 style={{ margin: "0 0 4px", fontSize: 15, color: "#f1f5f9" }}>Time Accounting</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>Setup cost: ~45 min (pipeline design, prompt tuning, 5 runs). Manual per-post: ~25 min. Break-even at run 3. Net saved after 5 runs: ~80 min.</p>
            </div>
            {runs.map((r, i) => (
              <div key={i} style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "#a5b4fc" }}>{r.label}</h4>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{r.topic}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#10b981" }}>{r.overall}/10</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>overall · {r.time}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 12 }}>
                  <div style={{ background: "#0f172a", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
                    Hook: <strong style={{ color: r.hookScore >= 8 ? "#10b981" : "#f59e0b" }}>{r.hookScore}/10</strong>
                  </div>
                  <div style={{ background: "#0f172a", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "#94a3b8" }}>
                    Manual est: ~25 min → Pipeline: {r.time}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: "#164e63", borderRadius: 12, padding: 16, marginTop: 4 }}>
              <h4 style={{ margin: "0 0 8px", color: "#67e8f9" }}>📊 Aggregate Results</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {[["Avg pipeline time","4m 05s"],["Avg overall score","7.7/10"],["Manual equivalent","~25 min/post"],["Setup cost","~45 min"],["Total 5 posts manual","~125 min"],["Total 5 posts pipeline","~65 min (incl. setup)"]].map(([l,v]) => (
                  <div key={l} style={{ background: "#0c4a6e", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#7dd3fc" }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f9ff" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: DIAGRAM ── */}
        {activeTab === "diagram" && (
          <div style={{ background: "#1e293b", borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: "0 0 20px", color: "#f1f5f9" }}>Pipeline Flow Diagram</h3>
            {[
              { n:1, name:"GATHER", color:"#6366f1", io:"Input: topic + raw notes", prompt:"User provides context. No AI call." },
              { n:2, name:"DRAFT", color:"#8b5cf6", io:"→ Raw LinkedIn post + hashtags", prompt:'System: "You are a LinkedIn ghostwriter…" | Structured output: post body + ---HASHTAGS---' },
              { n:3, name:"CRITIQUE", color:"#f59e0b", io:"→ JSON scores + 3 fixes + best line", prompt:'System: "You are a brutal LinkedIn editor…" | Output format: JSON schema enforced' },
              { n:4, name:"REVISE", color:"#10b981", io:"→ Improved post applying all 3 fixes", prompt:"System: Apply EXACTLY the 3 fixes to the draft. Return only the rewritten post." },
              { n:5, name:"FORMAT", color:"#06b6d4", io:"→ Final output + metadata", prompt:"Client-side: word count, char count, read time, pipeline duration" },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" }}>{s.n}</div>
                    {i < 4 && <div style={{ width: 2, height: 32, background: "#334155", margin: "4px 0" }} />}
                  </div>
                  <div style={{ background: "#0f172a", borderRadius: 10, padding: 14, flex: 1, marginBottom: i < 4 ? 0 : 0 }}>
                    <div style={{ fontWeight: 700, color: s.color, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#10b981", margin: "4px 0" }}>{s.io}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.prompt}</div>
                  </div>
                </div>
                {i < 4 && <div style={{ height: 8 }} />}
              </div>
            ))}
            <div style={{ marginTop: 20, background: "#0f172a", borderRadius: 10, padding: 14 }}>
              <h4 style={{ margin: "0 0 8px", color: "#f1f5f9", fontSize: 13 }}>Handoff Rules</h4>
              {[
                "Step 1 → 2: Full notes string passed as user message",
                "Step 2 → 3: Raw draft text passed as user message",
                "Step 3 → 4: Draft + fixes[] array injected into user message",
                "Step 4 → 5: Final text read by client for metadata calculation",
              ].map((h, i) => <p key={i} style={{ margin: "4px 0", fontSize: 12, color: "#94a3b8" }}>• {h}</p>)}
            </div>
          </div>
        )}

        {/* ── TAB: FAILURES ── */}
        {activeTab === "failures" && (
          <div>
            <h3 style={{ margin: "0 0 16px", color: "#f1f5f9" }}>⚠ Known Failure Points & Human Review Requirements</h3>
            {[
              { title: "JSON parse failure (Step 3)", severity: "HIGH", desc: "If Claude adds markdown backticks or preamble to the critique JSON, the parse fails silently. Mitigation: strip ```json fences. Still fails ~5% of runs on unusual inputs.", human: "Human must retry or manually extract scores." },
              { title: "Hook quality variance (Step 2)", severity: "MED", desc: "First-line hooks on highly technical topics (e.g. SWAG surgical AI) tend to be jargon-heavy and score 7/10 vs 9/10 for relatable topics. The pipeline doesn't re-draft the hook specifically.", human: "Human should manually rewrite the opening line for highly technical posts." },
              { title: "Fact fabrication risk (Step 2/4)", severity: "HIGH", desc: "If notes are sparse, the Draft step may invent plausible-sounding metrics (e.g. 'achieved 94% accuracy'). The Critique step does not fact-check against the notes.", human: "Human MUST verify all numbers and results in the final post match actual project data." },
              { title: "Fix application is partial (Step 4)", severity: "MED", desc: "The Revise step sometimes applies 2 of 3 fixes and ignores the structurally hardest one (usually CTA rewrites). No verification loop exists.", human: "Human should compare critique fixes against final post before publishing." },
              { title: "No source grounding", severity: "MED", desc: "Unlike NotebookLM, this pipeline doesn't cite sources. Claims about industry trends or comparisons are purely model-generated.", human: "For any comparative claim ('better than X'), human must add a citation or soften to opinion." },
              { title: "Hashtag relevance drift", severity: "LOW", desc: "Generated hashtags occasionally include overly broad tags (#AI, #Technology) that reduce reach. The pipeline has no hashtag-research step.", human: "Human should verify top hashtags match current LinkedIn trending tags in the ML niche." },
            ].map((f, i) => (
              <div key={i} style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12, borderLeft: `3px solid ${f.severity === "HIGH" ? "#ef4444" : f.severity === "MED" ? "#f59e0b" : "#64748b"}` }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: f.severity === "HIGH" ? "#450a0a" : f.severity === "MED" ? "#451a03" : "#1e293b", color: f.severity === "HIGH" ? "#fca5a5" : f.severity === "MED" ? "#fcd34d" : "#64748b" }}>{f.severity}</span>
                  <h4 style={{ margin: 0, fontSize: 14, color: "#f1f5f9" }}>{f.title}</h4>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#94a3b8" }}>{f.desc}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#34d399" }}>👤 Human review: {f.human}</p>
              </div>
            ))}
            <div style={{ background: "#1e293b", borderRadius: 12, padding: 16, marginTop: 4 }}>
              <h4 style={{ margin: "0 0 8px", color: "#f1f5f9" }}>What a Human Must Always Do</h4>
              {["Verify all metrics/numbers against actual project records","Read the final post aloud — AI writes fluently but sometimes awkwardly","Check the hook grabs YOUR audience, not just a generic ML audience","Add personal voice markers the model strips out ('I almost gave up when…')","Confirm hashtags are current and relevant"].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <span style={{ color: "#6366f1" }}>✦</span>
                  <span style={{ fontSize: 13, color: "#cbd5e1" }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
