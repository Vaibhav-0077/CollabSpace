# CollabSpace (Smart Collaborator Utility App)
## Open-Source Technical Research, System Architecture & Engineering Blueprint

---

### Executive Summary & Project Philosophy

**CollabSpace** is a free, open-source (FOSS), ultra-responsive, real-time collaborative visual whiteboard web application. It combines the tactile, zero-friction spontaneity of **Excalidraw** with the structured, smart-diagramming elegance of **Miro**, packaged in a distraction-free, hyper-clean design system.

#### Key Architectural & Product Shifts:
1. **Zero-Barrier Instant Access (No Login Page)**: 
   - No forced account creation, passwords, or OAuth walls. Users open the app, get an instant infinite canvas with a shareable cryptographic room URL (`/b/room-uuid`), choose an optional display nickname/color, and start collaborating immediately.
2. **Lean & Focused Scope (No Audio/Video Calling Overhead)**: 
   - Audio/video calling is intentionally stripped out. This eliminates complex WebRTC media servers, high server bandwidth costs, and battery drain, allowing 100% of the engineering effort and client resources to focus on 60 FPS canvas performance, real-time sync, and smart diagramming.
3. **100% Free & Open-Source Software (FOSS)**:
   - Permissive open-source license (MIT / Apache 2.0). Self-hostable via a single `docker-compose.yml`. Pluggable AI backend supporting both hosted providers (OpenAI, Anthropic, Gemini via user's API key) and local offline AI models (via Ollama or local LLM endpoints).
4. **Professional, Modern Design Language**:
   - Out-of-the-box support for curated dark and light themes, subtle glassmorphism/acrylic floating toolbars, buttery-smooth zoom/pan physics, contextual menus, and a complete, unified icon library (Lucide icons).

---

## 1. Deep Technical Breakdown of Core Topics & Usages

---

### Topic 1: Fabric.js (Retina Canvas + Object Graph)

#### The Problem with Native HTML5 Canvas
The standard HTML5 `<canvas>` element operates in **immediate mode**. When you call `ctx.fillRect(50, 50, 100, 100)`, the browser paints a grid of pixels into a bitmap buffer and immediately forgets what a "rectangle" is. If you want to move that rectangle, select it, resize it, or rotate it, you have to write complex custom math from scratch: manually tracking coordinates, clearing the entire canvas (`ctx.clearRect`), calculating mouse collision geometries, and redrawing every single pixel on every mouse move. 

Furthermore, on modern HiDPI and Apple Retina displays, a standard `<canvas>` renders blurry and pixelated because CSS pixels do not equal physical hardware screen pixels (`window.devicePixelRatio` is typically 2x or 3x).

#### What Fabric.js Does
Fabric.js provides a **retained-mode 2D canvas abstraction** layered on top of HTML5 Canvas. It introduces two fundamental pillars: **Retina Canvas Scaling** and the **Object Graph (Scene Graph)**.

```
+----------------------------------------------------------------------------------+
|                              FABRIC.JS ARCHITECTURE                              |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |                  RETAINED-MODE OBJECT GRAPH (SCENE GRAPH)                  |  |
|  |                                                                            |  |
|  |     [ Canvas Instance (Viewport Matrix: Zoom, Pan) ]                       |  |
|  |          |                                                                 |  |
|  |          +---> StickyNote (Group: Rect + Textbox)                          |  |
|  |          +---> FlowchartNode (Shape: Rect/Diamond + Anchors)               |  |
|  |          +---> DynamicConnector (Path/Bézier: Auto-calculates start/end)   |  |
|  |          +---> FreehandPencilPath (Smoothed Bézier curve points)           |  |
|  +----------------------------------------------------------------------------+  |
|                                       |                                          |
|                                       v                                          |
|  +----------------------------------------------------------------------------+  |
|  |                    RETINA / HiDPI RENDERING PIPELINE                       |  |
|  |                                                                            |  |
|  |  Physical Canvas Buffer:  (width * devicePixelRatio, height * dpr)         |  |
|  |  Context 2D Scale:        ctx.scale(devicePixelRatio, devicePixelRatio)    |  |
|  |  CSS Display Size:        width: 100vw, height: 100vh                     |  |
|  |  Result:                  Ultra-sharp lines, crisp text at 4K & Retina     |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

#### 1. Retina Canvas Scaling in CollabSpace
Fabric.js inspects `window.devicePixelRatio`. If a user is on a MacBook or 4K monitor where `devicePixelRatio = 2`:
- It allocates an internal bitmap buffer of $2\times$ resolution (e.g., $3840 \times 2160$ pixels).
- It scales the 2D rendering context automatically: `ctx.scale(2, 2)`.
- It sets the CSS styling to $(1920 \times 1080)$ points.
- **Usage in CollabSpace**: Drawing pen strokes, sticky note fonts, geometric shape outlines, and zoomed-in diagrams remain **razor-sharp and print-quality**, without blurriness, even when the user zooms into 400% magnification.

#### 2. The Object Graph (Scene Graph)
Fabric treats every element on the canvas as an interactive JavaScript object derived from `fabric.Object`.
- **Properties**: Every shape has intrinsic attributes: `id`, `left`, `top`, `width`, `height`, `scaleX`, `scaleY`, `angle`, `fill`, `stroke`, `opacity`, and custom metadata (e.g., `lockedBy`, `connectorIds`).
- **Interactive Control Handles**: When an object is clicked, Fabric automatically calculates its convex hull, generates 8 resize handles and a rotation lever, and handles corner-scaling math out of the box.
- **Event Dispatching**: Shapes fire granular lifecycle events: `object:moving`, `object:scaling`, `object:rotating`, `object:modified`, `selection:created`.
- **Usage in CollabSpace**:
  - We do not manage raw pixel redraws.
  - When User A drags a sticky note, we listen to `object:moving`, read `shape.left` and `shape.top`, recalculate attached dynamic connectors, and emit only the lightweight transform diff over the WebSocket.

---

### Topic 2: Hybrid Object LWW + Ephemeral Locks + Sequence Acks

#### The Collaborative Problem
In a real-time whiteboard, multiple users can interact with the same board concurrently. What happens if:
1. User A and User B drag the exact same rectangle at the exact same millisecond to two different corners of the screen?
2. Network latency causes User A’s packet to arrive *after* User B’s packet on Server X, but *before* on Client Y?
3. A user momentarily loses Wi-Fi for 5 seconds and reconnects?

Without a synchronization engine, shapes will jitter violently, snap between positions, and desynchronize across screens.

#### The Three-Pillar CollabSpace Solution

```
                                  CONCURRENCY TIMELINE
                                  
   User A (Editor)                     SERVER (Room Hub)                    User B (Editor)
         |                                     |                                   |
1. Click & Start Drag                          |                                   |
   emit("object:lock", { id: 42 })             |                                   |
   ------------------------------------------->|                                   |
                                               | 2. Grants Lock & Broadcasts       |
                                               |    emit("object:locked_by", ...)  |
                                               |---------------------------------->|
                                               |                     Renders colored outline
                                               |                     Disables interaction for B
                                               |                                   |
3. Dragging (Throttled 30ms)                   |                                   |
   emit("object:transforming", { left, top })  |                                   |
   ------------------------------------------->| 4. Ephemeral Relay                |
                                               |---------------------------------->|
                                               |                     Moves shape smoothly
                                               |                                   |
5. Mouse Release (Commit)                      |                                   |
   emit("object:modified", { id: 42, state })  |                                   |
   ------------------------------------------->| 6. Stamped: seq_id = 205          |
                                               |    Appends to PostgreSQL Log      |
                                               |    Emits "object:commit_ack"      |
                                               |<----------------------------------|
                                               |    broadcast("object:modified",   |
                                               |              seq: 205, state)     |
                                               |---------------------------------->|
                                               | 7. Releases Lock                  |
                                               |    broadcast("object:unlocked")   |
                                               |---------------------------------->|
```

#### 1. Ephemeral Locks (Prevention of Concurrent Mutation)
- **Mechanism**: When a user mouses down on any object to drag, resize, or type, the client sends `object:lock { objectId }`. The server stores an in-memory lock map: `locks.set(objectId, { userId, color, expiresAt })`.
- **Visual Feedback**: All other participants receive an `object:locked_by` broadcast. The target object renders an outline in User A's avatar color (e.g., a subtle purple halo) with a tiny nickname badge ("Alex is editing"). For all other users, interaction handles are temporarily disabled.
- **Safety Timeout**: Ephemeral locks automatically expire after 5 seconds of inactivity or if the user's socket disconnects, guaranteeing that an object is never permanently locked due to a crashed browser.
- **Usage in CollabSpace**: Completely eliminates simultaneous drag wars where two people fight over the same shape.

#### 2. Last-Write-Wins (LWW) with Version Numbers
- **Mechanism**: Every object contains a monotonic integer `version` and a high-resolution UTC timestamp `updatedAt`.
- **Conflict Resolution**: If two events for the same object bypass locks (e.g., changing background color vs changing border width), the server evaluates:
  $$\text{If } \text{incoming.version} > \text{current.version} \implies \text{Apply Update}$$
  If versions match, the latest server-side timestamp wins deterministically.
- **Usage in CollabSpace**: Provides deterministic convergence without needing heavy CRDT trees for every numeric coordinate.

#### 3. Sequence Acknowledgments (Sequence Acks)
- **The Out-of-Order Packet Problem**: On the internet, Packet #2 can arrive before Packet #1. If Packet #1 is an old move and Packet #2 is a new move, applying Packet #1 last causes a backward jump.
- **Mechanism**: The server assigns a strictly incrementing integer `seq_id` to every board mutation ($1, 2, 3, \dots, n$).
- When the server broadcasts an event, it includes `seq_id`. Every client tracks `local_seq_id`.
- **Packet Ordering**: Clients only apply events if `incoming.seq_id === local_seq_id + 1`.
- **Gap Detection & Catchup**: If a client receives `seq_id = 15` but its `local_seq_id = 12`, it immediately detects dropped packets $(13, 14)$ and requests a quick catchup: `emit("sync:request_deltas", { fromSeq: 13, toSeq: 15 })`.
- **Usage in CollabSpace**: Ensures bulletproof state consistency across all collaborative clients, even over unstable mobile hotspots or congested Wi-Fi.

---

### Topic 3: Dagre AST (Directed Acyclic Graph Layout AST)

#### Why LLMs Cannot Generate 2D Coordinates Directly
If you prompt an LLM: *"Draw a 4-tier microservice architecture with API Gateway, Auth Service, Order Service, and PostgreSQL,"* and ask it to output $(x, y)$ coordinates:
- The LLM will place nodes arbitrarily (e.g., placing the Database at $x=50, y=50$ and the Gateway at $x=40, y=40$), resulting in overlapping boxes, text running off the edges, and lines crossing haphazardly through the middle of shapes.
- LLMs are language models; they lack spatial visual perception and geometry collision math.

#### What is an AST in This Context?
An **Abstract Syntax Tree (AST)** is a structured, purely semantic JSON representation of the diagram. It describes **what** exists and **how** elements relate, without caring about pixel coordinates:

```json
{
  "direction": "TB",
  "theme": "modern-slate",
  "nodes": [
    { "id": "client", "label": "Web & Mobile Client", "shape": "rounded-rect" },
    { "id": "gw", "label": "API Gateway", "shape": "diamond" },
    { "id": "auth", "label": "Auth Microservice", "shape": "rounded-rect" },
    { "id": "db", "label": "User Credentials DB", "shape": "cylinder" }
  ],
  "edges": [
    { "from": "client", "to": "gw", "label": "HTTPS Request" },
    { "from": "gw", "to": "auth", "label": "gRPC Verify" },
    { "from": "auth", "to": "db", "label": "SQL Query" }
  ]
}
```

#### What is Dagre?
**Dagre** is a specialized directed graph layout library for JavaScript based on the classical **Sugiyama Hierarchical Layout Algorithm** (the same mathematical foundation behind Graphviz and Mermaid.js).

It executes in four distinct algorithmic phases:
1. **Cycle Removal**: Identifies feedback loops in the graph and temporarily reverses them to form a pure Directed Acyclic Graph (DAG).
2. **Layering (Rank Assignment)**: Assigns each node to a horizontal or vertical layer/tier (Rank 0: Client $\to$ Rank 1: Gateway $\to$ Rank 2: Auth $\to$ Rank 3: DB).
3. **Crossing Minimization**: Permutes the ordering of nodes within each rank using a barycenter/median heuristic to mathematically minimize the number of intersecting connector lines.
4. **Coordinate Assignment & Spline Routing**: Computes the exact physical pixel $(x, y)$ coordinates for every node, taking into account node dimensions and margins (`nodesep`, `ranksep`), and outputs bend points for edges.

```
+----------------------------------------------------------------------------------+
|                    THE TWO-STAGE AI DIAGRAM PIPELINE                             |
|                                                                                  |
|  [ User Prompt: "Create a user registration flow" ]                              |
|                          |                                                       |
|                          v                                                       |
|  +----------------------------------------------------------------------------+  |
|  | STAGE 1: LLM SEMANTIC PARSER (OpenAI / Gemini / Local Ollama)              |  |
|  | - Output: Strict Topological AST JSON (Nodes, Edges, Types, Labels)        |  |
|  | - Zero coordinate guessing; 100% semantic accuracy                         |  |
|  +----------------------------------------------------------------------------+  |
|                          |                                                       |
|                          v                                                       |
|  +----------------------------------------------------------------------------+  |
|  | STAGE 2: DAGRE GRAPH COMPILER                                              |  |
|  | - Calculates exact pixel layout: x, y, width, height                       |  |
|  | - Routes connector paths without collision                                 |  |
|  +----------------------------------------------------------------------------+  |
|                          |                                                       |
|                          v                                                       |
|  +----------------------------------------------------------------------------+  |
|  | STAGE 3: FABRIC.JS CANVAS INJECTION                                        |  |
|  | - Instantiates interactive Fabric shapes, text boxes, and Bézier lines     |  |
|  | - Groups into an editable composite diagram centered on user viewport      |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

#### Usage in CollabSpace
- The user clicks the **AI Diagram** tool, types: *"Kubernetes cluster with Ingress, 3 Pods, and a Redis Cache."*
- The backend or client calls the LLM with a strict JSON Schema prompt.
- Dagre computes the exact geometry in less than 15 milliseconds.
- CollabSpace paints fully editable, draggable, beautifully styled Fabric.js shapes connected with dynamic magnetic arrows. The user can immediately double-click to edit text, change colors, or drag nodes around.

---

### Topic 4: Fast Initial Paint (< 2.5MB), Headless Object Caching

#### 1. Fast Initial Paint (< 2.5MB Bundle Target)
Many web whiteboards feel sluggish because they load 15–30 MB of JavaScript bundles upfront: heavy PDF export engines (`jsPDF`, `pdfkit`), complex charting modules, large icon font files, and monolithic frameworks.

In CollabSpace, the target is **instant interactive readiness** ($< 2.5\text{MB}$ uncompressed payload / $< 600\text{KB}$ gzipped):

- **Route-Based & Feature-Based Code Splitting**:
  - The core canvas bundle contains only React, Fabric.js, Socket.IO client, and the core drawing tools.
  - Heavy export utilities (`jsPDF`, `canvg`, `svg2pdf`) are **dynamically imported** (`await import('jspdf')`) only when the user clicks "Export to PDF".
  - The AI generation modal and prompt parser are loaded only on demand when the AI tool is invoked.
- **Tree-Shaken Icon System**:
  - Instead of importing an entire monolithic icon pack, use modular SVG icons (via `lucide-react`) so only the exact icons used on the toolbar are bundled into the compiled binary.
- **Zero-Authentication Instant Paint**:
  - Because there is no login page, the browser skips authentication redirects, token handshakes, and profile lookups. The canvas paints the infinite grid in under 200ms on first load.

#### 2. Headless Object Caching in Fabric.js
When a canvas contains 500 to 1,500 objects (sticky notes, text blocks, paths, flowchart nodes), redrawing all vector curves on every pan or zoom frame at 60 FPS would cause severe frame drops and thermal throttling.

Fabric.js solves this with **Headless Object Caching** (`fabric.Object.prototype.objectCaching = true`).

```
+----------------------------------------------------------------------------------+
|                          HEADLESS OBJECT CACHING                                 |
|                                                                                  |
|  [ Complex Sticky Note / Vector Shape / Text ]                                   |
|                          |                                                       |
|                          v  (On initial creation or property modification)       |
|  +----------------------------------------------------------------------------+  |
|  | OFF-SCREEN ("HEADLESS") IN-MEMORY HTML5 CANVAS                             |  |
|  | - Renders complex vector paths, shadows, borders, text metrics once        |  |
|  | - Stores result as an in-memory bitmap texture                             |  |
|  +----------------------------------------------------------------------------+  |
|                          |                                                       |
|                          v  (During Canvas Panning, Zooming, or Moving Other Shapes)
|  +----------------------------------------------------------------------------+  |
|  | GPU-ACCELERATED BITMAP BLITTING (ctx.drawImage)                            |  |
|  | - Browser simply stamps the pre-rendered bitmap directly onto the viewport  |  |
|  | - Zero vector path re-calculation; zero font rasterization                 |  |
|  | - Sustains smooth 60 FPS even with 1,000+ objects on the board              |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **How It Works**:
  - For each object, Fabric creates an off-screen, headless `<canvas>` element in memory matching the object's dimensions.
  - Fabric renders the shape, text, and border onto this off-screen canvas once.
  - When the user pans, zooms, or moves *another* object on the board, Fabric does not recalculate the vector math for the cached shapes. It calls the GPU-accelerated `ctx.drawImage(offscreenCanvas, x, y)` method. Blitting a pre-rendered bitmap is hundreds of times faster than recalculating vector curves.
- **Cache Invalidation (`object.dirty = true`)**:
  - The off-screen cache is only refreshed when the object's own properties change (e.g., text is typed, fill color changes, or dimensions are resized).
- **Usage in CollabSpace**:
  - Guarantees butter-smooth 60 FPS pan and zoom physics on infinite canvases holding hundreds of user-generated shapes, sticky notes, and connectors.

---

## 2. Complete Iconography & Clean UI Design System

To ensure CollabSpace feels more polished, modern, and professional than existing platforms, it utilizes a tailored design language using **Lucide Icons**, a floating acrylic/glassmorphic toolbar, and contextual floating action bars.

### 2.1 Complete Toolbar & Feature Icon Mapping

| Category | Tool / Feature | Lucide Icon | Shortcut | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Navigation** | Select / Transform | `MousePointer2` | `V` | Select, drag, resize, rotate, and group shapes |
| | Hand / Pan Canvas | `Hand` | `H` / `Space` | Click-and-drag to pan the infinite canvas |
| **Creation** | Rectangle | `Square` | `R` | Rounded-corner boxes, containers, and wireframes |
| | Ellipse / Circle | `Circle` | `O` | Circles, ellipses, state indicators |
| | Diamond | `Diamond` | `D` | Decision nodes for flowcharts and logic trees |
| | Arrow / Connector | `MoveRight` | `A` | Dynamic smart connector with magnetic anchors |
| | Line | `Minus` | `L` | Straight and dashed dividers |
| | Freehand Pen | `Pencil` | `P` | Freehand drawing with Bézier stroke smoothing |
| | Text Block | `Type` | `T` | Auto-wrapping typography with font styling |
| | Sticky Note | `StickyNote` | `S` | Brainstorming notes with curated pastel palettes |
| | Image Upload | `Image` | `I` | Drag-and-drop or clipboard image placement |
| **Smart / AI** | AI Diagram Generator | `Sparkles` | `Cmd+K` | Natural language prompt to Dagre flowchart |
| | Auto-Arrange / Tidy | `LayoutGrid` | `Shift+A` | Mathematically cleans up and aligns messy nodes |
| | Templates Library | `Boxes` | — | Flowcharts, Kanban, Architecture, Retrospectives |
| **Canvas Controls**| Zoom In / Out | `ZoomIn` / `ZoomOut`| `+` / `-` | Zoom centered on viewport or cursor |
| | Reset Zoom to 100% | `Scan` | `Cmd+0` | Re-centers viewport to origin at 1:1 scale |
| | Zoom to Fit All | `Maximize2` | `Shift+1` | Frames all board contents within current viewport |
| | Grid Toggle | `Grid` | `Cmd+'` | Toggle subtle dot grid / isometric grid / blank |
| | Undo / Redo | `Undo2` / `Redo2` | `Cmd+Z` / `Cmd+Y` | Multi-step canvas history |
| **Collaboration** | Share Board Link | `Share2` | — | Copy instant invite URL with role picker |
| | Live Collaborators | `Users` | — | Avatars of active users currently viewing/editing |
| | Export (PNG/PDF/JSON)| `Download` | `Cmd+E` | Export high-res PNG, vector PDF, or JSON AST |
| | Theme Toggle | `Sun` / `Moon` | — | Instant switch between dark slate and clean light mode |
| | GitHub Repository | `Github` | — | Direct link to open-source project repository |

### 2.2 Visual Hierarchy & Layout Architecture

```
+----------------------------------------------------------------------------------+
|  [CollabSpace Logo]   [Board Title: Untitled]       [Users: (A) (B)] [Share] [Export]|
|----------------------------------------------------------------------------------|
|                                                                                  |
|   +------------------------------------------------------------------------+     |
|   | FLOATING DOCK TOOLBAR (Centered at top or bottom, glassmorphic acrylic)|     |
|   | [Hand] [Pointer] | [Rect] [Circle] [Diamond] [Note] [Pen] [Text] [Arrow] |     |
|   | | [Image] | [Sparkles: AI] | [Undo] [Redo]                             |     |
|   +------------------------------------------------------------------------+     |
|                                                                                  |
|                                                                                  |
|                   +---------------------------------------+                      |
|                   | CONTEXTUAL ACTION BAR (On Selection)  |                      |
|                   | [Fill Color] [Border] [Opacity]       |                      |
|                   | [Align] [Bring Front] [Delete]        |                      |
|                   +---------------------------------------+                      |
|                                                                                  |
|                                                                                  |
|                                                                                  |
|                                                                                  |
|----------------------------------------------------------------------------------|
|  [Zoom: 100%] [ - / + ] [Grid Toggle]                   [Keyboard Shortcuts (?)]  |
+----------------------------------------------------------------------------------+
```

---

## 3. Frictionless, No-Login Board Lifecycle & URL Model

To maximize adoption and usability, CollabSpace replaces forced authentication with a **Cryptographic Room-Link Model** (similar to Excalidraw):

1. **Creating a Board**:
   - Visiting `/` immediately provisions a unique cryptographically random room ID (e.g., `/b/7f9a2b8e-4c1d-4e92-b812-d9f8e7a6b5c4`) and renders the canvas within milliseconds.
2. **Collaborator Identity**:
   - When another user joins via the shared link, a lightweight modal or floating chip requests an optional **Nickname** and automatically assigns a distinct vibrant avatar color (e.g., Indigo, Teal, Amber, Rose).
   - Identity is stored in `localStorage` for future visits, requiring zero passwords or emails.
3. **Role-Based Link Permissions**:
   - The creator can toggle the share link between **Can Edit** and **Can View Only** (read-only mode).
   - In read-only mode, the client disarms drawing tools and the backend rejects incoming mutation events from that socket connection.

---

## 4. Open-Source Self-Hosting Architecture

CollabSpace is architected to run anywhere with zero proprietary dependencies:

```yaml
# docker-compose.yml (One-Click Self-Hostable Stack)
version: '3.8'

services:
  collabspace-web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgres://collab:collab_secret@postgres:5432/collabspace
      - AI_PROVIDER=ollama # Options: ollama, openai, gemini, anthropic
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=collab
      - POSTGRES_PASSWORD=collab_secret
      - POSTGRES_DB=collabspace
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- **Pluggable AI Backend**:
  - Self-hosters can connect **Ollama** running locally (`llama3`, `mistral`, or `qwen2.5-coder`) for 100% private, offline, free diagram generation.
  - Hosted cloud deployments can allow users to input their own personal OpenAI/Gemini API key stored safely in browser `localStorage`.

---

## 5. Technical Risk Analysis & Mitigation Matrix (Updated)

| Identified Risk | Severity | Probability | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Canvas Redraw Stutter with 500+ Objects** | High | Medium | Enable `fabric.Object.prototype.objectCaching = true`, implement off-screen viewport culling, and batch repaints with `requestAnimationFrame`. |
| **Simultaneous Object Mutation Conflicts** | High | High | Ephemeral selection locking prevents two users from dragging the same object at once; Sequence Acknowledgment (`seq_id`) guarantees deterministic order. |
| **AI Hallucinations in Spatial Layout** | High | High | Decouple semantics from geometry: LLM outputs purely topological AST; Dagre.js deterministically handles layout coordinates. |
| **Export Canvas Memory Overflow at 4K** | Medium | Low | Render export images off-screen using bounding box crops rather than the entire infinite canvas buffer. |
| **Spam / Board Vandalism on Public Links** | Medium | Medium | Provide instant one-click board snapshot restoration, exportable local JSON backups, and creator ability to switch link to read-only mode. |

---

## 6. Summary of Updated Project Blueprint

1. **No Login Page**: Replaced with instant guest room generation and lightweight nickname chips.
2. **No Video/Audio Calling**: Scope narrowed to visual whiteboard excellence, dynamic connectors, AI generation, and fast sync.
3. **Open-Source & Free**: MIT-licensed, single container self-hostable, with pluggable local (Ollama) or cloud AI.
4. **Professional UI System**: Lucide icons, glassmorphic toolbars, dark/light themes, and contextual selection bars.
5. **Technical Core**: Fabric.js Retina Canvas + Object Graph, Hybrid LWW + Ephemeral Locks + Sequence Acks, Dagre Layout AST, and $<2.5\text{MB}$ lazy-loaded bundles with headless caching.

---

## 7. Multi-Layer Security Architecture (No-Login Zero-Knowledge & Anti-Vandalism)

Building enterprise-grade security into an open-source, no-login platform requires defense-in-depth across the URL, WebSocket, and payload layers.

### 7.1 Cryptographic Privacy & Access Control
1. **128-bit Cryptographic URL Entropy**:
   - Board URLs are generated with UUIDv4 / 21-char nanoids (`/b/k7F9_wX2mP9qL1vR4yZ8a`), mathematically eliminating brute-force enumeration.
2. **Dual-Token System (Edit vs. View)**:
   - Edit URL: `/b/:id#key=...` (Grants editor role to socket session).
   - View URL: `/b/:id` (Socket flagged as viewer; backend rejects all incoming mutation events).
3. **Optional Board Password**:
   - Creator can set a board password hashed with Argon2id on the server. Collaborators must supply the passcode before Socket.IO allows room entry.
4. **Zero-Knowledge End-to-End Encryption (E2EE)**:
   - Client-side AES-GCM-256 encryption using Web Crypto API. Encryption key is in the URL fragment (`#key=...`), which is never transmitted over HTTP to the server. The server stores only encrypted ciphertext blobs.

### 7.2 WebSocket Anti-Flooding & Payload Sanitization
1. **Socket.IO Rate Limiting**:
   - Max 60 `transform` events/second (smooth 60 FPS drawing).
   - Max 10 `create`/`delete` operations/second to prevent script-based canvas freezes.
2. **Strict Zod Runtime Validation**:
   - Every mutation payload (`object:add`, `object:modify`, `object:remove`) is validated against strict Zod schemas, stripping unexpected prototype properties.
3. **SVG & XSS Deep Cleansing**:
   - All uploaded SVGs are stripped of `<script>`, `onload`, and external references via DOMPurify before parsing into Fabric.js.
   - Text boxes sanitize all input strings against HTML injection.

### 7.3 Anti-Griefing & Vandalism Safeguards
1. **Instant Snapshot Rollback**:
   - Creator can restore the board to any point in the last 60 minutes with one click, restoring from PostgreSQL immutable snapshots.
2. **"Freeze Board" Toggle**:
   - Creator can temporarily lock the entire board to read-only, instantly preventing all collaborators from mutating the canvas.
3. **Safe File Uploads**:
   - Images capped at 5MB, inspected for MIME/magic-byte headers, and stored with content-addressed hashes.

---

## 8. Beginner-Friendly UX & Progressive Disclosure Architecture

### 8.1 Zero-Friction Affordances
1. **Curing "Blank Canvas Paralysis"**:
   - First-time starter card disappears automatically upon first drawing or shape drop.
   - Instant 1-click starter templates (Blank, Brainstorming, Flowchart, Kanban).
2. **Tactile Direct Manipulation**:
   - Double-click anywhere to type text or drop a sticky note.
   - Text boxes automatically expand vertically to fit content without manual resizing.
3. **Magnetic Snap Anchors**:
   - Hovering the connector tool near any shape illuminates 4 glowing magnetic anchor dots (Top, Bottom, Left, Right) that auto-snap on drag.
4. **Progressive Disclosure**:
   - Advanced styling (colors, stroke width, opacity, delete) appears only in a contextual floating mini-bar directly above the selected object.
   - 8 curated pastel and vibrant color circles instead of confusing RGB sliders.

---

## 9. Master Build Specification: Component-by-Component & File Inventory

To ensure each and every piece of the system is accounted for, the following inventory catalogs all modules, files, and architectural responsibilities:

```
collabspace/
├── client/                               # Frontend React + TypeScript (Vite)
│   ├── index.html                        # HTML5 shell with responsive viewport
│   ├── src/
│   │   ├── main.tsx                      # App entry point & theme provider
│   │   ├── App.tsx                       # Room router (/ and /b/:id)
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── Whiteboard.tsx        # Canvas viewport container
│   │   │   │   ├── GridOverlay.tsx       # Infinite dot/grid renderer
│   │   │   │   └── SnappingGuides.tsx    # Alignment guidelines visualizer
│   │   │   ├── toolbar/
│   │   │   │   ├── FloatingDock.tsx      # Main bottom/top tool dock
│   │   │   │   ├── ToolButton.tsx        # Tool icon with Lucide & tooltip
│   │   │   │   └── ContextualBar.tsx     # Floating selection action menu
│   │   │   ├── collaboration/
│   │   │   │   ├── RemoteCursor.tsx      # Interpolated live cursor with label
│   │   │   │   ├── CollaboratorList.tsx  # Active user avatars
│   │   │   │   ├── ShareModal.tsx        # Copy edit/view link + password
│   │   │   │   └── FreezeBadge.tsx       # Read-only indicator banner
│   │   │   ├── ai/
│   │   │   │   ├── AIPromptModal.tsx     # Text prompt to diagram interface
│   │   │   │   └── AIProgressBar.tsx     # Real-time generation feedback
│   │   │   ├── export/
│   │   │   │   └── ExportModal.tsx       # PNG (2x/4k), SVG, PDF, JSON options
│   │   │   └── ui/
│   │   │       ├── ColorPalette.tsx      # Curated 8-swatch pastel picker
│   │   │       ├── Toast.tsx             # Notification & undo banners
│   │   │       └── KeyboardModal.tsx     # Shortcut cheat sheet
│   │   ├── hooks/
│   │   │   ├── useFabricCanvas.ts        # Fabric.js instance lifecycle & Retina init
│   │   │   ├── useInfiniteCanvas.ts      # Pan & zoom matrix math
│   │   │   ├── useDynamicConnectors.ts   # Dynamic Bézier connector anchor binding
│   │   │   ├── useSnapping.ts            # AABB bounding-box magnetic alignment
│   │   │   ├── useSocketSync.ts          # Socket.IO event handler & delta applier
│   │   │   └── useHistory.ts             # Client-side undo/redo stack
│   │   ├── services/
│   │   │   ├── socketClient.ts           # Socket.IO singleton with reconnection
│   │   │   ├── aiCompiler.ts             # Dagre AST to Fabric shape factory
│   │   │   ├── exportEngine.ts           # Dynamic import of jsPDF & PNG cropper
│   │   │   ├── cryptoService.ts          # AES-GCM-256 E2EE Web Crypto module
│   │   │   └── indexedDbQueue.ts         # Offline mutation buffer
│   │   └── types/
│   │       ├── canvas.ts                 # Shape definitions, tool modes
│   │       └── events.ts                 # Socket event payloads
│   └── vite.config.ts                    # Vite build with code splitting & alias
│
├── server/                               # Backend Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── index.ts                      # Server bootstrap (HTTP + WebSocket)
│   │   ├── socket/
│   │   │   ├── roomHub.ts                # Room join/leave & socket state
│   │   │   ├── lockManager.ts            # Ephemeral lock store with timeouts
│   │   │   ├── deltaRelay.ts             # Throttled mutation broadcaster & seq_id
│   │   │   └── rateLimiter.ts            # Sliding-window socket anti-flood
│   │   ├── controllers/
│   │   │   ├── boardController.ts        # Snapshot save/load REST endpoints
│   │   │   └── aiController.ts           # LLM prompt parser (OpenAI / Ollama)
│   │   ├── services/
│   │   │   ├── dagreLayoutService.ts     # Server-side layout fallback
│   │   │   └── sanitizationService.ts    # DOMPurify SVG & text cleaner
│   │   ├── db/
│   │   │   ├── client.ts                 # PostgreSQL connection pool (pg / Prisma)
│   │   │   └── migrations/               # SQL schema definitions
│   │   └── validation/
│   │       └── socketSchemas.ts          # Zod schemas for all inbound events
│   └── package.json
│
└── docker-compose.yml                    # One-command self-hosting config
```

### 9.2 Edge Cases & Reliability Matrix

1. **React 18 Double Mount in StrictMode**:
   - *Issue*: `useEffect` fires twice, instantiating duplicate canvas layers.
   - *Fix*: Single canvas ref with explicit `.dispose()` on cleanup and initialization guards.
2. **Orphaned Dynamic Connectors**:
   - *Issue*: Deleting a shape leaves its connected arrows floating in empty space.
   - *Fix*: Connector manager cascades deletion to connected lines or converts them into standalone terminal lines.
3. **Pinch-to-Zoom vs. Touch Drag**:
   - *Issue*: Mobile touch gestures conflict with canvas drawing.
   - *Fix*: Multi-touch gesture listener separates 2-finger pinch/zoom from 1-finger shape manipulation.
4. **Rapid Disconnect / Reconnect Recovery**:
   - *Issue*: Network flap causes socket reconnect while mid-drag.
   - *Fix*: Client resubmits active lock requests upon reconnect; server cleans up stale locks via 5-second TTL heartbeats.

