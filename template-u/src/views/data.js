// ============================================================================
//  View — Data table showcase
// ============================================================================

import { h } from "../framework/dom.js";
import { pageHeader, card, statTile, grid, badge } from "./helpers.js";
import { createDataTable } from "../components/datatable.js";
import { formatCurrency, formatDate, sum, average } from "../framework/utils.js";

const CLIENTS = [
  "Riverbend Bakery",
  "Cedar & Co. Bookkeeping",
  "Northside Cycle Works",
  "Bright Meadow Landscaping",
  "Harbor Light Roastery",
  "Pawsome Grooming",
  "Maple Street Deli",
  "Ironwood Carpentry",
  "Bluebird Studio",
  "Trailhead Outfitters",
  "Copper Kettle Catering",
  "Fernhill Florist",
];

const SERVICES = ["Monthly retainer", "Website refresh", "Bookkeeping audit", "On-site repair", "Brand package", "Consultation"];
const STATUSES = [
  { value: "Paid", tone: "success", weight: 5 },
  { value: "Pending", tone: "warning", weight: 3 },
  { value: "Overdue", tone: "danger", weight: 2 },
  { value: "Draft", tone: "neutral", weight: 1 },
];

function mulberry32(seed) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

function weightedStatus(random) {
  const pool = [];
  for (const status of STATUSES) for (let i = 0; i < status.weight; i++) pool.push(status);
  return pick(random, pool);
}

function makeRows(count = 26, seed = 7) {
  const random = mulberry32(seed);
  const rows = [];
  const base = Date.now();
  for (let i = 0; i < count; i++) {
    const status = weightedStatus(random);
    const issued = base + Math.floor(random() * 60 - 45) * 86400000;
    const due = issued + 30 * 86400000;
    rows.push({
      id: `INV-${String(1000 + i)}`,
      client: pick(random, CLIENTS),
      service: pick(random, SERVICES),
      amount: Math.round((150 + random() * 4800) * 100) / 100,
      status: status.value,
      tone: status.tone,
      issued,
      due,
    });
  }
  return rows;
}

export function render(outlet, ctx) {
  const { app } = ctx;
  const { toaster } = app;

  let rows = makeRows();
  const statsCtn = h("div", { class: "pu-grid pu-grid--4 pu-gap-md" });

  const table = createDataTable({
    caption: "Sample invoices",
    title: "",
    searchable: true,
    searchPlaceholder: "Search invoices…",
    pageSize: 8,
    rows,
    onRowClick: (row) => toaster.info(`${row.id} · ${row.client} · ${formatCurrency(row.amount)}`, { title: "Invoice selected" }),
    getRowId: (row) => row.id,
    columns: [
      { key: "id", label: "Invoice", sortable: true, width: "110px" },
      { key: "client", label: "Client", sortable: true },
      { key: "service", label: "Service", sortable: true, hideOnMobile: true },
      {
        key: "amount",
        label: "Amount",
        align: "right",
        sortable: true,
        sortValue: (row) => row.amount,
        format: (value) => formatCurrency(value),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: (value, row) => badge(value, row.tone),
      },
      {
        key: "due",
        label: "Due date",
        sortable: true,
        hideOnMobile: true,
        sortValue: (row) => row.due,
        format: (value) => formatDate(value),
      },
    ],
  });

  function renderStats(list) {
    const outstanding = list.filter((r) => r.status === "Pending" || r.status === "Overdue");
    statsCtn.replaceChildren(
      statTile({ label: "Invoices", value: String(list.length), icon: "table", hint: "sample data" }),
      statTile({ label: "Total invoiced", value: formatCurrency(sum(list, (r) => r.amount)), icon: "box", hint: "all statuses" }),
      statTile({ label: "Outstanding", value: formatCurrency(sum(outstanding, (r) => r.amount)), icon: "warning", hint: `${outstanding.length} invoices`, tone: "warning" }),
      statTile({ label: "Average invoice", value: formatCurrency(average(list, (r) => r.amount)), icon: "sparkle", hint: "mean value" })
    );
  }
  renderStats(rows);

  outlet.replaceChildren(
    pageHeader({
      title: "Data table",
      subtitle: "A responsive, sortable table for typical Project U business records.",
      icon: "table",
      actions: h(
        "button",
        {
          class: "pu-btn pu-btn--secondary",
          type: "button",
          onclick: () => {
            rows = makeRows(26, Math.floor(Math.random() * 100000));
            table.setRows(rows);
            renderStats(rows);
            app.toaster.success("Generated a fresh sample data set.");
          },
        },
        "Regenerate data"
      ),
    }),

    statsCtn,

    card({
      subtitle: "Click a column header to sort, use the search box to filter, and click a row for details. On phones the table reflows into labelled cards.",
      body: table.el,
    })
  );

  // Give the table the whole card body (drop the inner padding effect).
  outlet.querySelector(".pu-card")?.classList.add("pu-card--flush");
}
