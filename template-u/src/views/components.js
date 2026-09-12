// ============================================================================
//  View — Core UI components showcase
// ============================================================================

import { h, svgIcon } from "../framework/dom.js";
import { pageHeader, card, demoRow, grid, badge } from "./helpers.js";
import { textField, textareaField, selectField, toggleField, checkboxField, radioField, button } from "../components/inputs.js";

export function render(outlet, ctx) {
  const { app } = ctx;
  const { toaster } = app;

  // ---- form state echo -----------------------------------------------------
  const echo = h("pre", { class: "pu-code pu-code--small", "aria-live": "polite" }, "{}");
  const fields = [];
  const updateEcho = () => {
    const values = {};
    for (const field of fields) values[field.name] = field.value;
    echo.textContent = JSON.stringify(values, null, 2);
  };

  const nameField = textField({ name: "business", label: "Business name", placeholder: "e.g. Riverbend Bakery", value: "Riverbend Bakery", hint: "Shown on invoices and the client portal." });
  const emailField = textField({ name: "email", label: "Contact email", type: "email", placeholder: "you@example.com", value: "", required: true });
  const amountField = textField({ name: "amount", label: "Invoice amount", type: "number", value: "1250", prefix: "$", inputMode: "decimal", min: "0", step: "0.01" });
  const notesField = textareaField({ name: "notes", label: "Notes", placeholder: "Anything the client should know…", rows: 3, value: "" });
  const industryField = selectField({
    name: "industry",
    label: "Industry",
    value: "bakery",
    options: [
      { value: "bakery", label: "Bakery" },
      { value: "repair", label: "Bicycle repair" },
      { value: "bookkeeping", label: "Bookkeeping" },
      { value: "landscaping", label: "Landscaping" },
    ],
    hint: "Member generators can feed this from a Perchance list.",
  });
  const priorityField = radioField({
    name: "priority",
    label: "Priority",
    value: "normal",
    inline: true,
    options: [
      { value: "low", label: "Low" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "High" },
    ],
  });
  const reminderField = toggleField({ name: "reminder", label: "Send payment reminder", checked: true, hint: "Emails the client 3 days before due." });
  const termsField = checkboxField({ name: "terms", label: "Client accepted the terms" });

  fields.push(nameField, emailField, amountField, notesField, industryField, priorityField, reminderField, termsField);
  for (const field of fields) {
    field.input.addEventListener("input", updateEcho);
    field.input.addEventListener("change", updateEcho);
  }

  // A tiny inline validation example on blur.
  emailField.input.addEventListener("blur", () => {
    const value = emailField.value;
    if (value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) emailField.setError("Enter a valid email address.");
    else emailField.clearError();
  });

  updateEcho();

  const buttonRow = (...buttons) => h("div", { class: "pu-btn-row" }, buttons);

  outlet.replaceChildren(
    pageHeader({
      title: "Core UI components",
      subtitle: "Standardized, accessible building blocks shared by every Project U generator.",
      icon: "layout",
    }),

    card({
      title: "Buttons",
      subtitle: "Variants, sizes and states.",
      body: h(
        "div",
        { class: "pu-demo-list" },
        demoRow({
          label: "Variants",
          control: buttonRow(
            button({ label: "Primary", variant: "primary", onClick: () => toaster.info("Primary action") }),
            button({ label: "Secondary", variant: "secondary", onClick: () => toaster.info("Secondary action") }),
            button({ label: "Ghost", variant: "ghost", onClick: () => toaster.info("Ghost action") }),
            button({ label: "Success", variant: "success", onClick: () => toaster.success("Saved successfully") }),
            button({ label: "Danger", variant: "danger", onClick: () => toaster.error("Record deleted") })
          ),
        }),
        demoRow({
          label: "Sizes & icons",
          control: buttonRow(
            button({ label: "Small", size: "sm", variant: "secondary" }),
            button({ label: "Medium", size: "md", variant: "secondary" }),
            button({ label: "Large", size: "lg", variant: "secondary" }),
            button({ label: "With icon", variant: "primary", icon: "plus" }),
            button({ label: "Disabled", variant: "secondary", disabled: true })
          ),
        })
      ),
    }),

    card({
      title: "Form inputs",
      subtitle: "Text, textarea, select, radio, toggle and checkbox — with hints and inline errors.",
      body: h(
        "div",
        { class: "pu-form-grid" },
        nameField.el,
        emailField.el,
        amountField.el,
        industryField.el,
        h("div", { class: "pu-form-span" }, priorityField.el),
        h("div", { class: "pu-form-span" }, notesField.el),
        h("div", { class: "pu-form-span pu-stack-2" }, reminderField.el, termsField.el)
      ),
    }),

    grid(
      [
        card({
          title: "Field values",
          subtitle: "What the form currently holds.",
          body: echo,
        }),
        card({
          title: "Toasts",
          subtitle: "Global feedback channel for async actions.",
          body: h(
            "div",
            { class: "pu-btn-row pu-btn-row--wrap" },
            button({ label: "Success", variant: "success", onClick: () => toaster.success("Client record saved.", { title: "Saved" }) }),
            button({ label: "Info", variant: "secondary", onClick: () => toaster.info("Export started — this can take a moment.") }),
            button({ label: "Warning", variant: "warning", onClick: () => toaster.warning("Two records have missing fields.") }),
            button({ label: "Error", variant: "danger", onClick: () => toaster.error("Could not reach the server.", { title: "Sync failed" }) }),
            button({
              label: "With action",
              variant: "ghost",
              onClick: () =>
                toaster.info("Draft document was generated.", {
                  title: "Draft ready",
                  action: { label: "Open", onClick: () => toaster.success("Opening draft…") },
                }),
            })
          ),
        }),
      ],
      { cols: 2 }
    ),

    card({
      title: "Badges & status",
      subtitle: "Compact status indicators used across tables and headers.",
      body: h(
        "div",
        { class: "pu-btn-row pu-btn-row--wrap" },
        badge("Paid", "success", { icon: "check" }),
        badge("Pending", "warning", { icon: "warning" }),
        badge("Overdue", "danger", { icon: "error" }),
        badge("Draft", "neutral"),
        badge("New", "info", { icon: "info" }),
        badge("v0.1.0", "neutral")
      ),
    })
  );
}
