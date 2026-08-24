(function (root) {
  "use strict";

  const elements = {
    reviewerId: document.querySelector("#reviewerId"),
    reviewerExpertise: document.querySelector("#reviewerExpertise"),
    bundleFile: document.querySelector("#bundleFile"),
    reviewFile: document.querySelector("#reviewFile"),
    exportButton: document.querySelector("#exportButton"),
    emptyState: document.querySelector("#emptyState"),
    reviewArea: document.querySelector("#reviewArea"),
    progressText: document.querySelector("#progressText"),
    progressBar: document.querySelector("#progressBar"),
    caseButtons: document.querySelector("#caseButtons"),
    caseTag: document.querySelector("#caseTag"),
    caseId: document.querySelector("#caseId"),
    caseFacts: document.querySelector("#caseFacts"),
    expectedDetail: document.querySelector("#expectedDetail"),
    expectedRisk: document.querySelector("#expectedRisk"),
    noSuitable: document.querySelector("#noSuitable"),
    candidateCards: document.querySelector("#candidateCards"),
    reviewerNote: document.querySelector("#reviewerNote"),
    prevCase: document.querySelector("#prevCase"),
    nextCase: document.querySelector("#nextCase")
  };
  const app = {
    elements,
    state: {
      bundle: null,
      review: null,
      currentIndex: 0,
      activeReviewerId: "anonymous"
    },
    render: null
  };
  const review = root.ScenarioReview;

  app.render = () => review.renderer.render(app);
  review.files.bindFileInputs(app);
  review.navigation.bindNavigation(app);
  review.files.loadDefaultBundle(app);
}(window));
