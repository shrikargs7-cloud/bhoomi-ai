import React, { useEffect, useState } from 'react';
import {
  GitBranch,
  Clock,
  Users,
  Network,
  Sliders,
  RotateCcw,
  FileText,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useBhoomi } from '../context/BhoomiContext';
import { OwnershipGraphResponse } from '../types/bhoomi';
import { OwnershipFlowGraph } from '../components/ownership/OwnershipFlowGraph';

type OwnershipTab = 'graph' | 'timeline' | 'entities' | 'inspector';

export const OwnershipPage: React.FC = () => {
  const { activeCase, role, t, openEvidence, apiFetch, showToast, refreshCase } = useBhoomi();

  const [activeTab, setActiveTab] = useState<OwnershipTab>('graph');
  const [graphData, setGraphData] = useState<OwnershipGraphResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Display Settings sliders (genuinely transform the graph!)
  const [showSettings, setShowSettings] = useState(true);
  const [genSpacing, setGenSpacing] = useState(250);
  const [rowSpacing, setRowSpacing] = useState(95);
  const [lineWidth, setLineWidth] = useState(2.5);
  const [lineOpacity, setLineOpacity] = useState(85);
  const [accentColor, setAccentColor] = useState('#239B65');
  const [canvasBg, setCanvasBg] = useState('#F7F5EB');

  useEffect(() => {
    if (!activeCase) return;
    apiFetch(`/cases/${encodeURIComponent(activeCase.case_id)}/ownership/graph`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setGraphData(d);
        if (d?.nodes?.length) {
          setSelectedNodeId(d.nodes[0].id);
        }
      })
      .catch(() => {});
  }, [activeCase?.case_id, activeCase?.ownership_events.length, apiFetch]);

  if (!activeCase) {
    return (
      <div className="mx-auto max-w-7xl p-8 text-center text-sm text-slate-500">
        Loading Ownership Lineage...
      </div>
    );
  }

  const handleResolvePerson = async (personId: string, status: string) => {
    const res = await apiFetch(
      `/cases/${encodeURIComponent(activeCase.case_id)}/persons/${encodeURIComponent(personId)}/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution_status: status,
          notes: `Marked ${status} by reviewer`,
        }),
      }
    );
    if (res.ok) {
      showToast(`Entity marked as ${status}.`, 'ok');
      await refreshCase();
    }
  };

  const nodes = graphData?.nodes || [];
  const edges = graphData?.edges || [];
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const filteredEvents = activeCase.ownership_events.filter(
    (ev) => eventTypeFilter === 'all' || ev.event_type === eventTypeFilter
  );

  return (
    <div className="min-h-screen bg-[#F7F5EB] pb-10">
      {/* Header + 4-Tab Bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-2xs">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-extrabold text-[#123D32] flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[#239B65]" />
              {t('ownership_title')}
            </h1>
            <p className="text-xs text-slate-500">
              {activeCase.case_id} • Survey No. {activeCase.survey_number} •{' '}
              {activeCase.persons.length} persons • {activeCase.ownership_events.length} documented events
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#F7F5EB] p-1 border border-slate-200">
            {[
              { id: 'graph', label: 'Pedigree Graph', icon: GitBranch },
              { id: 'timeline', label: 'Event Timeline', icon: Clock },
              { id: 'entities', label: 'Entity Resolution', icon: Users },
              { id: 'inspector', label: 'Graph Inspector', icon: Network },
            ].map((tb) => {
              const Icon = tb.icon;
              const isAct = activeTab === tb.id;
              return (
                <button
                  key={tb.id}
                  onClick={() => setActiveTab(tb.id as OwnershipTab)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    isAct
                      ? 'bg-[#123D32] text-white shadow-xs'
                      : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tb.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAB 1: INTERACTIVE PEDIGREE & LINEAGE GRAPH */}
      {activeTab === 'graph' && (
        <div className="relative mx-auto max-w-[1400px] px-4 py-5 lg:px-6">
          <div
            className="relative overflow-hidden rounded-2xl border border-[#164E49]/20 shadow-sm"
            style={{ backgroundColor: canvasBg }}
          >
            {/* Top Controls inside Graph Canvas */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-white/85 px-4 py-2 backdrop-blur-xs text-xs">
              <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#164E49]" /> Document
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D6A84B]" /> Event
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#239B65]" /> Parcel
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#123D32]" /> Person
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Drag nodes or scroll to zoom
                </span>
                <button
                  onClick={() => setShowSettings((s) => !s)}
                  className="ml-2 flex items-center gap-1 rounded-lg bg-[#123D32] px-3 py-1.5 text-[11px] font-bold text-white cursor-pointer"
                >
                  <Sliders className="h-3 w-3" />
                  <span>{showSettings ? 'Hide Settings' : 'Display Settings'}</span>
                </button>
              </div>
            </div>

            {/* React Flow Interactive Lineage Canvas */}
            <OwnershipFlowGraph
              rawNodes={nodes}
              rawEdges={edges}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              genSpacing={genSpacing}
              rowSpacing={rowSpacing}
              lineWidth={lineWidth}
              lineOpacity={lineOpacity}
              accentColor={accentColor}
              canvasBg={canvasBg}
            />

            {/* Selected Node Details Bar */}
            {selectedNode && (
              <div className="border-t border-slate-200 bg-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="rounded bg-[#123D32] px-2 py-0.5 text-[10px] font-bold text-white mr-2">
                    {selectedNode.node_type}
                  </span>
                  <strong className="text-[#123D32]">{selectedNode.label}</strong>
                  {selectedNode.meta?.description && (
                    <p className="text-slate-600 mt-1">{selectedNode.meta.description}</p>
                  )}
                </div>
                {selectedNode.node_type === 'Document' && selectedNode.meta?.doc_id && (
                  <button
                    onClick={() =>
                      openEvidence({
                        documentId: selectedNode.meta.doc_id,
                        documentName: selectedNode.label,
                        page: 1,
                      })
                    }
                    className="rounded-lg bg-[#239B65] px-3 py-1.5 font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                  >
                    Open Document PDF
                  </button>
                )}
              </div>
            )}

            {/* Floating Interactive Display Settings Panel */}
            {showSettings && (
              <div className="absolute right-4 top-14 w-64 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-xs space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold uppercase tracking-wider text-[#123D32] text-[11px]">
                    Display Settings
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setGenSpacing(250);
                        setRowSpacing(95);
                        setLineWidth(2.5);
                        setLineOpacity(85);
                        setAccentColor('#239B65');
                        setCanvasBg('#F7F5EB');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Reset display settings"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Generation spacing</span>
                    <span className="font-mono font-bold">{genSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="190"
                    max="360"
                    value={genSpacing}
                    onChange={(e) => setGenSpacing(Number(e.target.value))}
                    className="w-full accent-[#239B65]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Row spacing</span>
                    <span className="font-mono font-bold">{rowSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="68"
                    max="150"
                    value={rowSpacing}
                    onChange={(e) => setRowSpacing(Number(e.target.value))}
                    className="w-full accent-[#239B65]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Line width</span>
                    <span className="font-mono font-bold">{lineWidth}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="6"
                    step="0.5"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="w-full accent-[#239B65]"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span>Line opacity</span>
                    <span className="font-mono font-bold">{lineOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    value={lineOpacity}
                    onChange={(e) => setLineOpacity(Number(e.target.value))}
                    className="w-full accent-[#239B65]"
                  />
                </div>

                <div>
                  <p className="text-[11px] mb-1.5">Accent colour</p>
                  <div className="flex gap-2">
                    {['#239B65', '#123D32', '#D6A84B', '#164E49', '#dc2626', '#2563eb'].map((c) => (
                      <button
                        key={c}
                        onClick={() => setAccentColor(c)}
                        className={`h-5 w-5 rounded-full cursor-pointer ${
                          accentColor === c ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[11px] mb-1.5">Canvas Background</p>
                  <div className="flex gap-2">
                    {['#F7F5EB', '#FFFFFF', '#eef4f1', '#f1f5f9'].map((bg) => (
                      <button
                        key={bg}
                        onClick={() => setCanvasBg(bg)}
                        className={`h-5 w-5 rounded-full border border-slate-300 cursor-pointer ${
                          canvasBg === bg ? 'ring-2 ring-offset-2 ring-slate-900' : ''
                        }`}
                        style={{ backgroundColor: bg }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHRONOLOGICAL EVENT TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="mx-auto max-w-[1100px] px-4 py-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#123D32]">
              Chronological Ownership &amp; Mutation Timeline ({filteredEvents.length} events)
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {['all', 'partition', 'sale', 'death', 'mutation', 'mortgage', 'rtc_record'].map((et) => (
                <button
                  key={et}
                  onClick={() => setEventTypeFilter(et)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold cursor-pointer ${
                    eventTypeFilter === et
                      ? 'bg-[#123D32] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {et}
                </button>
              ))}
            </div>
          </div>

          <div className="relative space-y-4 pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#164E49]/25">
            {filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full bg-[#239B65] ring-4 ring-[#F7F5EB]" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#123D32] px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                      {ev.date || 'Date Undocumented'}
                    </span>
                    <span className="rounded bg-[#F7F5EB] px-2 py-0.5 text-[11px] font-bold uppercase text-[#164E49]">
                      {ev.event_type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ev.status === 'documented'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  {ev.extent_affected && (
                    <span className="text-xs font-bold text-[#164E49]">
                      Extent: {ev.extent_affected}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-slate-700 leading-relaxed">{ev.description}</p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px]">
                  <span className="text-slate-500">
                    Parties: <strong>{ev.parties_involved.join(', ') || 'Revenue Authority'}</strong>
                  </span>
                  <button
                    onClick={() =>
                      openEvidence({
                        documentId: ev.evidence.document_id,
                        documentName: ev.evidence.document_name,
                        page: ev.evidence.page,
                        highlightBBox: ev.evidence.bounding_box,
                        highlightText: ev.evidence.original_text,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-[#F7F5EB] border border-slate-200 px-2.5 py-1 font-semibold text-[#123D32] hover:bg-[#239B65] hover:text-white cursor-pointer"
                  >
                    <FileText className="h-3 w-3" />
                    <span>
                      {ev.evidence.document_name} (p.{ev.evidence.page})
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ENTITY RESOLUTION */}
      {activeTab === 'entities' && (
        <div className="mx-auto max-w-[1100px] px-4 py-6 space-y-4">
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-[#123D32]">
              Person Entity Resolution (Jaro-Winkler + Kannada Transliteration)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Uncertain name candidates (similarity 0.68–0.87) are never auto-merged and require reviewer confirmation.
            </p>

            <div className="mt-4 space-y-3">
              {activeCase.persons.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#fdfcf8] p-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#123D32]">{p.canonical_name}</span>
                      {p.is_deceased && (
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Deceased {p.date_of_death}
                        </span>
                      )}
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {p.resolution_status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Normalized: <span className="font-mono">{p.normalized_name}</span> •
                      Aliases: {p.aliases.join(', ')} • Match Score:{' '}
                      <strong>{Math.round(p.similarity_score * 100)}%</strong>
                    </p>
                  </div>

                  {role === 'reviewer' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolvePerson(p.id, 'reviewer_confirmed')}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#239B65] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#1b8153] cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Identity
                      </button>
                      <button
                        onClick={() => handleResolvePerson(p.id, 'distinct')}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        Mark Distinct
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GRAPH INSPECTOR */}
      {activeTab === 'inspector' && (
        <div className="mx-auto max-w-[1200px] px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#123D32] mb-3">
              NetworkX Nodes ({nodes.length})
            </h3>
            <div className="overflow-auto max-h-[460px] rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Label</th>
                    <th className="py-2 px-3">Node ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nodes.map((n) => (
                    <tr key={n.id}>
                      <td className="py-2 px-3 font-bold text-[#164E49]">{n.node_type}</td>
                      <td className="py-2 px-3 font-medium">{n.label}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-slate-400">{n.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[#164E49]/15 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#123D32] mb-3">
              NetworkX Edges ({edges.length})
            </h3>
            <div className="overflow-auto max-h-[460px] rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-[#F7F5EB] text-[10px] font-bold uppercase text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Source</th>
                    <th className="py-2 px-3">Relation</th>
                    <th className="py-2 px-3">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {edges.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-mono text-[10px]">{e.source}</td>
                      <td className="py-2 px-3">
                        <span className="rounded bg-[#F7F5EB] px-2 py-0.5 text-[10px] font-bold text-[#123D32]">
                          {e.relation}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px]">{e.target}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
