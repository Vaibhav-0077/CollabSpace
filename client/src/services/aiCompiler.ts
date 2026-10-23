import { Canvas, Rect, Polygon, Textbox, Line, Group } from 'fabric';
import { nanoid } from 'nanoid';

interface NodeSpec {
  id: string;
  label: string;
  shape: 'rect' | 'diamond' | 'cylinder';
  fill: string;
  stroke: string;
}

interface EdgeSpec {
  from: string;
  to: string;
  label?: string;
}

interface DiagramTopology {
  title: string;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export function parsePromptToTopology(prompt: string): DiagramTopology {
  const p = prompt.toLowerCase();

  if (p.includes('kanban') || p.includes('board') || p.includes('todo')) {
    return {
      title: 'Kanban Workflow',
      nodes: [
        { id: '1', label: 'Backlog\n• User research\n• API design', shape: 'rect', fill: '#fef08a', stroke: '#eab308' },
        { id: '2', label: 'In Progress\n• Auth endpoints\n• Canvas engine', shape: 'rect', fill: '#bae6fd', stroke: '#0284c7' },
        { id: '3', label: 'Code Review\n• Unit tests\n• PR review', shape: 'rect', fill: '#e9d5ff', stroke: '#9333ea' },
        { id: '4', label: 'Completed\n• Schema migrations\n• CI/CD pipeline', shape: 'rect', fill: '#bbf7d0', stroke: '#16a34a' },
      ],
      edges: [
        { from: '1', to: '2' },
        { from: '2', to: '3' },
        { from: '3', to: '4' },
      ],
    };
  }

  if (p.includes('decision') || p.includes('onboard') || p.includes('signup')) {
    return {
      title: 'Onboarding Decision Flow',
      nodes: [
        { id: '1', label: 'User Registration', shape: 'rect', fill: '#bae6fd', stroke: '#3b82f6' },
        { id: '2', label: 'Email Verified?', shape: 'diamond', fill: '#fed7aa', stroke: '#f97316' },
        { id: '3', label: 'Workspace Dashboard', shape: 'rect', fill: '#bbf7d0', stroke: '#10b981' },
        { id: '4', label: 'Send Reminder Email', shape: 'rect', fill: '#fbcfe8', stroke: '#ec4899' },
      ],
      edges: [
        { from: '1', to: '2' },
        { from: '2', to: '3', label: 'Yes' },
        { from: '2', to: '4', label: 'No' },
      ],
    };
  }

  // Default: Microservices / Architecture flow
  return {
    title: 'Microservices Architecture',
    nodes: [
      { id: '1', label: 'Web & Mobile Client\n(React 18 + TS)', shape: 'rect', fill: '#e0e7ff', stroke: '#6366f1' },
      { id: '2', label: 'API Gateway\n(Rate Limiting & Auth)', shape: 'diamond', fill: '#fed7aa', stroke: '#f97316' },
      { id: '3', label: 'Core Microservice\n(Node.js + Socket.IO)', shape: 'rect', fill: '#bae6fd', stroke: '#0284c7' },
      { id: '4', label: 'PostgreSQL DB\n(Snapshots & Audit)', shape: 'rect', fill: '#bbf7d0', stroke: '#10b981' },
    ],
    edges: [
      { from: '1', to: '2', label: 'HTTPS' },
      { from: '2', to: '3', label: 'gRPC' },
      { from: '3', to: '4', label: 'SQL' },
    ],
  };
}

export function compileAndInjectDiagram(canvas: Canvas, topology: DiagramTopology) {
  const zoom = canvas.getZoom();
  const vpt = canvas.viewportTransform;
  const centerX = (-vpt[4] + canvas.getWidth() / 2) / zoom;
  const centerY = (-vpt[5] + canvas.getHeight() / 2) / zoom;

  const nodeWidth = 190;
  const nodeHeight = 90;
  const spacingX = 260;
  const startX = centerX - ((topology.nodes.length - 1) * spacingX) / 2;

  const nodeMap = new Map<string, { x: number; y: number }>();

  // 1. Create nodes in horizontal rank layout
  topology.nodes.forEach((nodeSpec, i) => {
    const x = startX + i * spacingX;
    const y = centerY;
    nodeMap.set(nodeSpec.id, { x, y });

    let shapeObj;
    if (nodeSpec.shape === 'diamond') {
      const size = 110;
      shapeObj = new Polygon(
        [
          { x: size / 2, y: 0 },
          { x: size, y: size / 2 },
          { x: size / 2, y: size },
          { x: 0, y: size / 2 },
        ],
        {
          fill: nodeSpec.fill,
          stroke: nodeSpec.stroke,
          strokeWidth: 2,
        }
      );
    } else {
      shapeObj = new Rect({
        width: nodeWidth,
        height: nodeHeight,
        rx: 10,
        ry: 10,
        fill: nodeSpec.fill,
        stroke: nodeSpec.stroke,
        strokeWidth: 2,
      });
    }

    const text = new Textbox(nodeSpec.label, {
      width: nodeWidth - 24,
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'Plus Jakarta Sans',
      fill: '#1e293b',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      left: nodeSpec.shape === 'diamond' ? 55 : nodeWidth / 2,
      top: nodeSpec.shape === 'diamond' ? 55 : nodeHeight / 2,
    });

    const group = new Group([shapeObj, text], {
      id: nanoid(8),
      left: x - (nodeSpec.shape === 'diamond' ? 55 : nodeWidth / 2),
      top: y - (nodeSpec.shape === 'diamond' ? 55 : nodeHeight / 2),
      shadow: {
        color: 'rgba(0,0,0,0.15)',
        blur: 16,
        offsetX: 0,
        offsetY: 6,
      },
    } as any);

    canvas.add(group);
  });

  // 2. Create connecting lines between nodes
  topology.edges.forEach((edge) => {
    const fromPos = nodeMap.get(edge.from);
    const toPos = nodeMap.get(edge.to);
    if (!fromPos || !toPos) return;

    const line = new Line([fromPos.x + 95, fromPos.y, toPos.x - 95, toPos.y], {
      id: nanoid(8),
      stroke: '#818cf8',
      strokeWidth: 2,
      selectable: true,
    } as any);

    canvas.add(line);
  });

  canvas.requestRenderAll();
}
