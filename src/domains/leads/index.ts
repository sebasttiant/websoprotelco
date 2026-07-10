// Public surface of the leads domain. Consumers (contact page, admin leads pages,
// components) must import from here rather than reaching into ./schemas,
// ./repository, ./service, or ./actions directly.

export type {
  LeadAssignInput,
  LeadCreateInput,
  LeadNote,
  LeadNoteInput,
  LeadSource,
  LeadStatus,
  LeadStatusUpdateInput,
  LeadSummary,
} from "./schemas";

export { LEAD_SOURCES, LEAD_STATUSES } from "./schemas";

export {
  addLeadNote,
  assignLead,
  createLead,
  updateLeadStatus,
  type LeadsActionState,
} from "./actions";

export { getLead, getLeadNotes, getLeads } from "./service";
