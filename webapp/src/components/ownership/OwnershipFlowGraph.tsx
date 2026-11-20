import React, { memo, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { OwnershipGraphResponse } from '../../types/bhoomi';

type GraphNode = OwnershipGraphResponse['nodes'][number];
type GraphEdge = OwnershipGraphResponse['edges'][number];

interface BhoomiNodeData extends Record<string, unknown> {
  label: string;
  nodeType: string;
  badgeColor: string;
  subtitle: string;
  isDeceased: boolean;
  isSelected: boolean;
  accentColor: string;
}

type BhoomiFlowNode = Node<BhoomiNodeData, 'bhoomi'>;

const BhoomiLineageNode = memo(({ data }: NodeProps<BhoomiFlowNode>) => {
  return (
    <div
      className="relative flex w-[200px] overflow-hidden rounded-xl bg-white shadow-xs transition"
      style={{
        border: data.isSelected
          ? `2px solid ${data.accentColor}`
          : '1.5px solid #cbd5e1',
        boxShadow: data.isSelected ? `0 0 0 3px ${data.accentColor}26` : undefined,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-white !bg-slate-400"
      />
      <div className="w-2 shrink-0" style={{ backgroundColor: data.badgeColor }} />
      <div className="flex-1 px-2.5 py-2 min-w-0">
        <p
          className="text-[9px] font-extrabold uppercase tracking-wider truncate"
          style={{ color: data.badgeColor }}
        >
          {data.nodeType}
          {data.isDeceased ? ' • DECEASED' : ''}
        </p>
        <p className="mt-0.5 text-[11px] font-bold text-slate-900 truncate" title={data.label}>
          {data.label}
        </p>
        <p className="mt-0.5 text-[9.5px] text-slate-500 truncate" title={data.subtitle}>
          {data.subtitle}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-white !bg-slate-400"
      />
    </div>
  );
});

BhoomiLineageNode.displayName = 'BhoomiLineageNode';

const NODE_TYPES = { bhoomi: BhoomiLineageNode };
const COL_ORDER = ['Document', 'Event', 'Parcel', 'Person'] as const;

function badgeColorForNode(n: GraphNode): string {
  if (n.node_type === 'Document') return '#164E49';
  if (n.node_type === 'Event') return '#D6A84B';
  if (n.node_type === 'Parcel') return '#239B65';
  return n.meta?.is_deceased ? '#b91c1c' : '#123D32';
}

function subtitleForNode(n: GraphNode): string {
  return String(
    n.meta?.doc_type ||
      n.meta?.status ||
      n.meta?.date_of_death ||
      n.meta?.resolution_status ||
      'Click node to inspect'
  );
}

interface OwnershipFlowGraphProps {
  rawNodes: GraphNode[];
  rawEdges: GraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  genSpacing: number;
  rowSpacing: number;
  lineWidth: number;
  lineOpacity: number;
  accentColor: string;
  canvasBg: string;
}

/** Interactive @xyflow/react DAG explorer for Document -> Event -> Parcel -> Person lineage. */
export const OwnershipFlowGraph: React.FC<OwnershipFlowGraphProps> = ({
  rawNodes,
  rawEdges,
  selectedNodeId,
  onSelectNode,
  genSpacing,
  rowSpacing,
  lineWidth,
  lineOpacity,
  accentColor,
  canvasBg,
}) => {
  const computeLayoutNodes = useCallback((): BhoomiFlowNode[] => {
    const columns: Record<string, GraphNode[]> = {
      Document: rawNodes.filter((n) => n.node_type === 'Document'),
      Event: rawNodes.filter((n) => n.node_type === 'Event'),
      Parcel: rawNodes.filter((n) => n.node_type === 'Parcel'),
      Person: rawNodes.filter((n) => n.node_type === 'Person'),
    };

    const positioned: BhoomiFlowNode[] = [];
    COL_ORDER.forEach((colKey, colIdx) => {
      const list = columns[colKey] || [];
      const totalH = Math.max(1, list.length - 1) * rowSpacing;
      const startY = Math.max(40, 260 - totalH / 2);
      list.forEach((n, idx) => {
        positioned.push({
          id: n.id,
          type: 'bhoomi',
          position: { x: 48 + colIdx * genSpacing, y: startY + idx * rowSpacing },
          data: {
            label: n.label,
            nodeType: n.node_type,
            badgeColor: badgeColorForNode(n),
            subtitle: subtitleForNode(n),
            isDeceased: Boolean(n.meta?.is_deceased),
            isSelected: selectedNodeId === n.id,
            accentColor,
          },
        });
      });
    });

    return positioned;
  }, [rawNodes, genSpacing, rowSpacing, selectedNodeId, accentColor]);

  const computedEdges = useMemo<Edge[]>(() => {
    return rawEdges.map((e, i) => ({
      id: `edge-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      label: e.relation,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: accentColor,
      },
      style: {
        stroke: accentColor,
        strokeWidth: lineWidth,
        opacity: lineOpacity / 100,
      },
      labelStyle: {
        fontSize: 9,
        fontWeight: 700,
        fill: '#1e293b',
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.92,
      },
      labelBgPadding: [4, 2] as [number, number],
    }));
  }, [rawEdges, accentColor, lineWidth, lineOpacity]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<BhoomiFlowNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setRfNodes(computeLayoutNodes());
  }, [computeLayoutNodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(computedEdges);
  }, [computedEdges, setRfEdges]);

  return (
    <div data-theme="light" className="relative h-[560px] w-full" style={{ backgroundColor: canvasBg }}>
      <ReactFlow
        className="light"
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_ev, node) => onSelectNode(node.id)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1.2}
          color="#cbd5e1"
          bgColor={canvasBg}
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => String((node.data as BhoomiNodeData | undefined)?.badgeColor || '#123D32')}
          maskColor="rgba(247, 245, 235, 0.72)"
        />
      </ReactFlow>

      <button
        type="button"
        onClick={() => setRfNodes(computeLayoutNodes())}
        className="absolute left-3 top-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#123D32] shadow-xs hover:bg-[#F7F5EB] cursor-pointer"
      >
        Reset Layout
      </button>
    </div>
  );
};
