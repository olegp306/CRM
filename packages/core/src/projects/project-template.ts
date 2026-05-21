export type ProjectTemplateTask = {
  title: string;
  checklist: string[];
};

export type ProjectTemplatePhase = {
  name: string;
  tasks: ProjectTemplateTask[];
};

export function createDefaultProjectTemplate(): { phases: ProjectTemplatePhase[] } {
  return {
    phases: [
      {
        name: "Negotiations",
        tasks: [{ title: "Confirm contract and deposit", checklist: ["Contract signed", "Deposit received"] }]
      },
      {
        name: "Ecosystem",
        tasks: [{ title: "Create project decision log", checklist: ["Decision log opened", "Initial assumptions recorded"] }]
      },
      {
        name: "Client/project discovery",
        tasks: [{ title: "Collect client inputs", checklist: ["Questionnaire sent", "Missing documents listed"] }]
      },
      {
        name: "Analysis",
        tasks: [{ title: "Run site analysis", checklist: ["B-Plan checked", "LBO checked", "Constraints recorded"] }]
      },
      {
        name: "File preparation",
        tasks: [{ title: "Prepare drawing file", checklist: ["Template copied", "Site boundaries added"] }]
      },
      {
        name: "First sketch",
        tasks: [{ title: "Prepare first sketch options", checklist: ["Option 1", "Option 2", "Option 3"] }]
      },
      {
        name: "Revisions",
        tasks: [{ title: "Process revision round", checklist: ["Feedback recorded", "Decision log updated"] }]
      },
      {
        name: "LP3",
        tasks: [{ title: "Complete design planning", checklist: ["Plans updated", "Client approval recorded"] }]
      },
      {
        name: "LP4",
        tasks: [{ title: "Prepare permit planning", checklist: ["Permit set prepared", "Special topics checked"] }]
      },
      {
        name: "Submission",
        tasks: [{ title: "Submit to Bauamt", checklist: ["Submission package exported", "Submission date recorded"] }]
      },
      {
        name: "Bauamt feedback",
        tasks: [{ title: "Process authority feedback", checklist: ["Questions logged", "Responses sent"] }]
      },
      {
        name: "Completed/archive",
        tasks: [{ title: "Archive project", checklist: ["Final files stored", "Project status closed"] }]
      }
    ]
  };
}
