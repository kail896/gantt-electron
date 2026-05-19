# 横道图 Gantt — 工程项目进度管理

A desktop Gantt chart application for construction and engineering project scheduling. Built with Electron.

## Features

- **Task Management** — Create, edit, and organize tasks with parent-child hierarchy. Add task names, dates, durations, owners, and progress tracking.
- **Gantt Chart Visualization** — Interactive timeline bars with day/week/month zoom levels. Progress fill and today line indicators.
- **Drag & Drop** — Reorder tasks by dragging table rows. Resize Gantt bars by dragging handles.
- **Column Resizing** — Adjust table column widths by dragging header handles.
- **Parent-Only Sorting** — Sort root tasks by any column; children stay grouped under their parent.
- **Undo / Redo** — Snapshot-based undo/redo with 50-level history.
- **File Management** — Save/open projects in `.gantt` format. Recent files list. Auto-save support.
- **Excel Import/Export** — Import tasks from `.xlsx` files. Export the full schedule to Excel with formatted headers.
- **PDF Export** — Export the Gantt chart to PDF (landscape A4).
- **Split Panel** — Resizable table/Gantt panel divider.

## Screenshot

```
┌─────────────────────────────────────────────────────┐
│  文件    编辑    视图    帮助                横道图  │
├─────────────────────────────────────────────────────┤
│ [+ 任务] [+ 子任务] [− 删除] | [展开] [折叠] | ...  │
├──────────────┬──┬───────────────────────────────────┤
│ 任务名称     │ ⋮ │  ◄───── 甘特图时间线 ─────►      │
│ ├ 基础工程   │ ⋮ │  ████████░░░░                    │
│ │ 土方开挖   │ ⋮ │  ████████░░░░                    │
│ │ 地基处理   │ ⋮ │  ░░░░████░░░░                    │
│ ├ 主体结构   │ ⋮ │       ░░████████████░░░░         │
│ │ 一层钢筋   │ ⋮ │       ░░████████░░░░             │
│ └ 二层混凝土 │ ⋮ │              ░░████░░            │
├──────────────┴──┴───────────────────────────────────┤
│ 准备就完毕  |  8 项  |  未命名项目  |  周视图  |  ⋮  │
└─────────────────────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm start
```

### Build

```bash
# Build DMG installer
npm run build

# Build .app bundle only (faster)
npm run build:dir
```

The built app will be in `dist/`.

## Usage

### Tasks

- **Add Task** — Click `+ 任务` or press `⌘T` to add a root task.
- **Add Child Task** — Click `+ 子任务` or press `⌘⇧T` to add a subtask under the selected task.
- **Delete** — Select a task and press `Delete` or click `− 删除`.
- **Reorder** — Drag any task row and drop it at the desired position.
- **Sort** — Click a column header to sort root tasks. Click again to reverse; click a third time to clear sort.

### Gantt Chart

- **Zoom** — Switch between day (`⌘1`), week (`⌘2`), and month (`⌘3`) views.
- **Resize Bars** — Drag the left/right edge of a Gantt bar to change start/end dates.
- **Move Bars** — Drag the center of a Gantt bar to shift the task timeline.

### Columns

- **Resize** — Drag the right edge of any column header.
- **Progress** — Enter a percentage (0–100) in the plan column. Parent progress auto-calculates as a weighted average of children.

### Files

- **Save** — `⌘S` to save as `.gantt` file.
- **Open** — `⌘O` to open a saved project.
- **Export Excel** — `⌘E` to export to `.xlsx`.
- **Export PDF** — `⌘P` to export to PDF.

## Data Format

Projects are saved as JSON (`.gantt` extension) containing tasks with the following structure:

```
task: {
  id: number,
  text: string,          // task name
  start_date: string,    // YYYY-MM-DD
  end_date: string,      // YYYY-MM-DD
  duration: number,      // days
  owner: string,         // responsible person
  progress: number,      // 0–100
  actual_progress: number,
  parent: number|null,   // parent task id or null for root tasks
  sortorder: number,
  open: boolean          // expanded/collapsed in tree
}
```

## Tech Stack

- **Electron 27** — Desktop framework
- **Vanilla JavaScript** — No framework dependencies
- **XLSX / ExcelJS** — Excel file import/export
- **table-layout: fixed** — Column width management

## License

MIT
