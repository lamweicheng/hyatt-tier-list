export type PhaseDefinition = {
  id: number;
  name: string;
  shortDescription: string;
  steps: string[];
};

export const PHASES: PhaseDefinition[] = [
  {
    id: 0,
    name: 'Phase 1 – Instance Initialization',
    shortDescription:
      'Confirm and adjust ownership, timelines, and requirements for the specific forecast period prior to execution.',
    steps: [
      'Confirm the specific forecast period and scope for this instance.',
      'Confirm and adjust ownership: assignee(s) and approver(s).',
      'Confirm and adjust timelines: forecast preparation, approver review/approval, and submission due dates.',
      'Confirm and adjust requirements: key notes, assumptions, and any required attachments.',
      'Initiate the forecast instance so Phase 2 execution can begin.'
    ]
  },
  {
    id: 1,
    name: 'Phase 2 – Forecast preparation',
    shortDescription:
      'Assigned assignee(s) are notified, prepare the forecast file, and submit it for review/approval.',
    steps: [
      'Assignee(s) receive a notification with all information set up in Phase 1.',
      'Assignee(s) prepare the forecast file and align internally as needed.',
      'Assignee(s) upload the prepared forecast file into the system.',
      'Assignee(s) submit the file to the defined reviewers/approvers for Phase 2.',
      'If changes are requested, assignee(s) update the forecast file and resubmit for Phase 2.'
    ]
  },
  {
    id: 2,
    name: 'Phase 3 – Forecast review & approval',
    shortDescription:
      'Approvers review the uploaded forecast, approve it, or send it back to assignee(s) with required changes.',
    steps: [
      'Approvers receive notifications that a forecast file is ready for review.',
      'Approvers open the forecast file and review the content.',
      'Approvers record comments and either approve or request changes.',
      'If approved, the forecast is marked as ready for submission to TPM (Phase 3).',
      'If changes are needed, approvers send it back to Phase 1 with clear required updates for the assignee(s).'
    ]
  },
  {
    id: 3,
    name: 'Phase 4 – Submission to TPM',
    shortDescription:
      'Once approved, EM Manager sends the forecast to TPM via Outlook and records the send date.',
    steps: [
      'EM Manager is notified that the forecast passed Phase 2 review and approval.',
      'EM Manager downloads or accesses the final approved forecast file.',
      'EM Manager sends the forecast file to TPM via Outlook (outside of this tool).',
      'After sending, EM Manager comes back to the portal, checks a box to confirm submission, and inputs the send date.'
    ]
  },
  {
    id: 4,
    name: 'Phase 5 – TPM email confirmation & forecast storing',
    shortDescription:
      "Capture TPM's confirmation email, record the confirmation date, upload the finalized forecast file, and close the forecast instance.",
    steps: [
      'TPM replies via email to confirm receipt and acceptance of the forecast.',
      "Upload or attach a copy/screenshot of TPM's confirmation email.",
      'Record the date TPM confirmed the forecast.',
      'Upload or link the finalized forecast file into the agreed storage location.',
      'Close the forecast instance so it appears as completed in reporting views.',
      'If TPM requests changes, record the requested modifications and revert the forecast instance back to Phase 2 to re-run preparation + review/approval.'
    ]
  }
];
