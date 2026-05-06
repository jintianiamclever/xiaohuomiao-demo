const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// 托管当前文件夹里的前端页面
app.use(express.static(__dirname));

// 测试接口
app.get("/api/test-ai", (req, res) => {
  res.json({
    ok: true,
    message: "小火苗演示版 AI 识别已开启：当前使用本地模拟输出。",
  });
});

// 模拟 AI 识别任务接口
app.post("/api/recognize-task", (req, res) => {
  const text = req.body?.text || req.body?.input || "";

  let taskName = "学习任务";
  let category = "课程作业";
  let description = text || "根据用户输入生成学习任务。";

  if (text.includes("高数")) {
    taskName = "高数作业";
    category = "学习高数";
  } else if (text.includes("外部中断") || text.includes("第五章")) {
    taskName = "第5章外部中断作业";
    category = "课程作业";
  } else if (text.includes("英语") || text.includes("演讲")) {
    taskName = "英语演讲准备";
    category = "英语表达";
  } else if (text.includes("产品") || text.includes("比赛")) {
    taskName = "AI产品大赛任务";
    category = "项目任务";
  }

  res.json({
    ok: true,
    data: {
      taskName,
      category,
      description,
      priority: "A",
      subtasks: [
        {
          name: "回顾任务要求，明确要完成什么",
          estimatedMinutes: 10,
          priority: "B",
          isLowEnergy: true,
          suggestedAbilities: ["管理能力"]
        },
        {
          name: "完成核心内容的第一小步",
          estimatedMinutes: 30,
          priority: "A",
          isLowEnergy: false,
          suggestedAbilities: ["执行力", "专注力"]
        }
      ]
    }
  });
});

// 模拟任务完成反馈接口
app.post("/api/finish-feedback", (req, res) => {
  const taskName = req.body?.taskName || "这个任务";
  const spentMinutes = req.body?.spentMinutes || 1;
  const progressBefore = req.body?.progressBefore ?? 50;
  const progressAfter = req.body?.progressAfter ?? 100;

  res.json({
    ok: true,
    data: {
      flameMessage: `今天你不仅开始了「${taskName}」，还坚持了 ${spentMinutes} 分钟，真的很棒！`,
      dailySentence: "出发的感觉太好了，世界突然充满了可能性。",
      achievement: `你完成了「${taskName}」。`,
      progressText: `${progressBefore}% → ${progressAfter}%`
    }
  });
});

app.listen(PORT, () => {
  console.log(`小火苗演示后端已启动：http://localhost:${PORT}`);
});