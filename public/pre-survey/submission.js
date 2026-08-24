window.PreSurveySubmission = {
  submit(apiClient, payload, requestId) {
    return apiClient.postJson("/api/submit", payload, requestId);
  },
};
