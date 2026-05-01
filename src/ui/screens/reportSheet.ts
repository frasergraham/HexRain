// Report-challenge modal sheet — radio reasons + optional note +
// submit. Phase 2.13.

import { escapeHtml } from "../escape";
import type { Screen } from "../Screen";
import type { ReportReason } from "../../cloudSync";

export interface ReportSheetProps {
  reason: ReportReason;
  note: string;
}

const REASONS: ReadonlyArray<{ id: ReportReason; label: string }> = [
  { id: "inappropriate_name", label: "Inappropriate name" },
  { id: "offensive_content", label: "Offensive content" },
  { id: "unplayable", label: "Broken / unplayable" },
  { id: "other", label: "Other" },
];

export const ReportSheet: Screen<ReportSheetProps | null> = {
  render(props) {
    if (!props) return "";
    const radios = REASONS.map((r) => `
      <label class="report-reason">
        <input type="radio" name="report-reason" value="${r.id}" ${r.id === props.reason ? "checked" : ""} />
        <span>${r.label}</span>
      </label>
    `).join("");
    return `
      <div class="modal-backdrop" data-action="close-report">
        <div class="modal-sheet report-sheet" role="dialog" aria-label="Report challenge">
          <header class="modal-sheet-header">
            <span>Report challenge</span>
            <button type="button" class="modal-close" data-action="close-report" aria-label="Close">✕</button>
          </header>
          <div class="report-body">
            ${radios}
            <textarea class="report-note" maxlength="240" rows="3" placeholder="Optional note (240 chars)" data-report-note>${escapeHtml(props.note)}</textarea>
          </div>
          <div class="report-actions">
            <button type="button" class="play-btn report-submit" data-action="submit-report">SUBMIT</button>
          </div>
        </div>
      </div>
    `;
  },
};
