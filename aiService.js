(function () {
  function normalizeResult(result) {
    if (!result || result.isTask === false) {
      return {
        isTask: false,
        reason: result?.reason || "输入内容不像课程任务、作业要求或 DDL。",
        bigTaskTitle: null,
        bigTaskPriority: null,
        deadline: null,
        notes: [],
        subtasks: []
      };
    }

    return {
      isTask: true,
      reason: result.reason || "已识别到课程任务或 DDL。",
      bigTaskTitle: result.bigTaskTitle || "课程 DDL",
      bigTaskPriority: ["A", "B", "C"].includes(result.bigTaskPriority) ? result.bigTaskPriority : "C",
      deadline: result.deadline || "",
      notes: Array.isArray(result.notes) ? result.notes.filter(Boolean) : [],
      subtasks: Array.isArray(result.subtasks)
        ? result.subtasks.map((item) => ({
            title: item.title || "具体学习任务",
            estimatedMinutes: Math.max(1, Number(item.estimatedMinutes) || 30),
            priority: ["A", "B", "C"].includes(item.priority) ? item.priority : "A",
            startAction: item.startAction || "先打开相关资料，找到可以马上开始的第一步。"
          }))
        : []
    };
  }

  async function extractTasks(text) {
    const response = await fetch("/api/extract-ddl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) {
      throw new Error(data.error || "AI 服务请求失败，请稍后重试。");
    }
    return normalizeResult(data);
  }

  window.aiService = {
    extractTasks
  };
})();
